/**
 * Project Axiom: Auth Service
 * Lightweight OAuth2 code-flow + PKCE wrapper (Google direct via a worker that holds
 * the client secret, or legacy Cognito). Zero-dependency, zero-build.
 *
 * Reconciled 2026-09-05 from the live projects (tender/ev/scobot) — see
 * docs/auth-readme.md for the storage keys, the worker contract and what each
 * downstream keeps local. Pure logic lives in auth-helpers.js (node-tested).
 */
import { state } from '@state';
import { config } from '@core/config.js';
import { log } from '@core/logger.js';
import {
  buildAuthorizeUrl, generateCodeVerifier, generateCodeChallenge,
  hydrateProfile, normalizeAvatarUrl, isRefreshRejected, refreshDelayMs
} from '@core/auth-helpers.js';

const STORAGE_KEY = 'axiom_auth';              // token bundle
const PKCE_VERIFIER_KEY = 'axiom_pkce_verifier'; // held across the provider redirect
const STATE_KEY = 'axiom_oauth_state';         // CSRF correlation, held across the redirect
const PROVIDER_KEY = 'axiom_auth_provider';    // 'google' | 'cognito' — routes refresh
const PROFILE_KEY = 'axiom_profile';           // last-known-good sub/email/name/picture
const AVATAR_KEY = 'axiom-avatar';             // { key, url, data } data-URL cache
const GOOGLE_AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth';

// Identity that persists across reloads — the token bundle and the last-known
// profile/avatar — goes through ONE store the app chooses: init({ tokenStore }).
// The OAuth flow's one-shot keys (PKCE verifier, CSRF state, provider) stay in
// localStorage whatever the choice: some in-app browsers finish the redirect in
// a fresh tab where sessionStorage is empty.
const IDENTITY_KEYS = [STORAGE_KEY, PROFILE_KEY, AVATAR_KEY];

const memoryStore = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
};

/** 'local' | 'session' | 'memory' | { getItem, setItem, removeItem } -> a store. */
const resolveStore = (choice) => {
  if (choice && typeof choice === 'object') {
    if (['getItem', 'setItem', 'removeItem'].every((m) => typeof choice[m] === 'function')) return choice;
    throw new TypeError('auth.init: a custom tokenStore needs getItem, setItem and removeItem');
  }
  if (choice === 'local') return localStorage;
  if (choice === 'session') return sessionStorage;
  if (choice === 'memory') return memoryStore();
  throw new TypeError(`auth.init: unknown tokenStore '${choice}' — use 'local' | 'session' | 'memory' | an adapter`);
};

// One window for both paths: an on-demand call inside it refreshes, and the keep-alive
// timer fires at its leading edge so an idle tab never meets an expired token.
const REFRESH_WINDOW_MS = 10 * 60 * 1000;
// Transient refresh failure (5xx, network, cold start): retry cadence, not a logout.
const REFRESH_RETRY_MS = 60 * 1000;

export const auth = {
  _tokens: null,
  _user: null,
  _refreshing: null,   // single in-flight refresh promise
  _keepAlive: true,    // init({ keepAlive }) — proactive refresh timer + visibility hook
  _refreshTimer: null,
  _onVisible: null,
  _store: null,        // init({ tokenStore }) — where persisted identity lives

  /** The identity store; localStorage until init() says otherwise. */
  get _s() { return this._store || localStorage; },

  /**
   * Initialize auth state from storage or handle the OAuth callback.
   * Call this BEFORE router.init().
   * @param {{ keepAlive?: boolean, tokenStore?: 'local'|'session'|'memory'|Storage }} [options]
   *   keepAlive (default true) arms the proactive refresh timer + visibility hook;
   *   an app that prefers to refresh only on demand passes { keepAlive: false }.
   *   tokenStore (default 'local') is where the token bundle and profile persist:
   *   'session' ends with the tab, 'memory' with the page, or pass an adapter.
   *   No store protects a token from script running in the page — SECURITY.md.
   */
  async init({ keepAlive = true, tokenStore = 'local' } = {}) {
    this._keepAlive = keepAlive;
    this._store = resolveStore(tokenStore);
    // Choosing a shorter-lived store must actually retire the long-lived copy:
    // identity left in localStorage by an earlier session would outlive it.
    if (this._store !== localStorage) for (const k of IDENTITY_KEYS) localStorage.removeItem(k);
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      await this._handleCallback(code, params.get('state'));
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    // Hydrate from storage
    const stored = this._s.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      this._tokens = JSON.parse(stored);
      const refreshed = await this.checkAndRefresh();
      // A TRANSIENT refresh failure on a still-valid token keeps the session — the
      // old "refresh failed → clear" nuked live sessions on a worker cold start.
      if (refreshed || this.isAuthenticated()) {
        this._installUser();
        log.info('Auth restored from session', { refreshed });
      } else {
        log.warn('Session expired and refresh failed');
        this._clear();
      }
    } catch (e) {
      log.error('Failed to parse stored auth', e);
      this._clear();
    }
  },

  /** Check if user is authenticated (token present and not past expiry). */
  isAuthenticated() {
    return !!this._tokens && this._tokens.expiresAt > Date.now();
  },

  /** Alias for isAuthenticated — preferred for readability in UI code */
  isLoggedIn() {
    return this.isAuthenticated();
  },

  /** Check if user has admin role. */
  isAdmin() {
    return !!(this._user?.admin || this._user?.is_admin);
  },

  /**
   * Ensure the token is valid, refreshing if inside the refresh window.
   * Concurrent callers (every gateway request calls this) share ONE refresh.
   * Resolves true when the token is usable, false when it is not.
   */
  async checkAndRefresh() {
    if (!this._tokens) return false;
    const isExpiring = Date.now() + REFRESH_WINDOW_MS > this._tokens.expiresAt;
    if (!isExpiring) return true;
    if (!this._tokens.refreshToken) {
      log.warn('Token expiring and no refresh token available');
      return this.isAuthenticated();
    }
    return this._refresh();
  },

  /** Get the current Access Token, ensuring it is fresh. */
  async getAccessToken() {
    const ok = await this.checkAndRefresh();
    return ok ? this._tokens?.accessToken ?? null : null;
  },

  /** Get the current ID Token (JWT), ensuring it is fresh. */
  async getIdToken() {
    const ok = await this.checkAndRefresh();
    return ok ? this._tokens?.idToken ?? null : null;
  },

  /** Get current user info. */
  getUser() {
    return this._user;
  },

  /**
   * Initiate OAuth login with the specified provider.
   * @param {string} provider - 'Google', 'Facebook' (Cognito identity providers) or 'DirectGoogle'
   */
  async loginWith(provider = 'Google') {
    const { USER_POOL_DOMAIN, CLIENT_ID, GOOGLE_CLIENT_ID, REDIRECT_URI } = this._getConfig();

    // PKCE + CSRF state, both held across the redirect. localStorage on purpose:
    // some in-app browsers complete the redirect in a fresh tab where
    // sessionStorage is empty.
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const stateToken = generateCodeVerifier();
    localStorage.setItem(PKCE_VERIFIER_KEY, verifier);
    localStorage.setItem(STATE_KEY, stateToken);

    // Direct Google (worker-brokered exchange)
    if (provider === 'DirectGoogle' || (GOOGLE_CLIENT_ID && !USER_POOL_DOMAIN)) {
      localStorage.setItem(PROVIDER_KEY, 'google');
      window.location.href = buildAuthorizeUrl({
        authorizationEndpoint: GOOGLE_AUTHORIZE,
        clientId: GOOGLE_CLIENT_ID,
        redirectUri: REDIRECT_URI,
        challenge,
        state: stateToken,
        extra: {
          access_type: 'offline', // required for a refresh_token
          prompt: 'consent'       // forces consent → guarantees a refresh_token
        }
      });
      return;
    }

    // Legacy: Cognito hosted UI
    localStorage.setItem(PROVIDER_KEY, 'cognito');
    window.location.href = buildAuthorizeUrl({
      authorizationEndpoint: `https://${USER_POOL_DOMAIN}/oauth2/authorize`,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      challenge,
      state: stateToken,
      extra: { identity_provider: provider }
    });
  },

  /** Log out and clear session. */
  async logout() {
    const { USER_POOL_DOMAIN, CLIENT_ID, REDIRECT_URI } = this._getConfig();

    this._clear();
    state.set('user', null);

    // Session context is the application's to clear: it reacts to user -> null
    // (see src/app-state.js). Core auth names no application key.

    if (USER_POOL_DOMAIN) {
      const logoutUrl = new URL(`https://${USER_POOL_DOMAIN}/logout`);
      logoutUrl.searchParams.set('client_id', CLIENT_ID);
      logoutUrl.searchParams.set('logout_uri', REDIRECT_URI);
      window.location.href = logoutUrl.toString();
    } else {
      // Direct Google path — navigate to root; router guard redirects to /login
      window.location.href = '/';
    }
  },

  // --- Private Methods ---

  async _handleCallback(code, returnedState) {
    const verifier = localStorage.getItem(PKCE_VERIFIER_KEY);
    const expectedState = localStorage.getItem(STATE_KEY);
    const provider = localStorage.getItem(PROVIDER_KEY);
    const turnstileToken = sessionStorage.getItem('turnstile_auth_token');
    localStorage.removeItem(STATE_KEY); // one-shot, whatever happens next

    if (!verifier) {
      log.error('No PKCE verifier found — session may have opened in a different browser context');
      state.notify('Login session expired. Please try again.', 'error');
      return;
    }
    if (!expectedState || returnedState !== expectedState) {
      // The callback did not originate from a login this browser started.
      log.error('OAuth state mismatch — callback rejected');
      state.notify('Login could not be verified. Please try again.', 'error');
      localStorage.removeItem(PKCE_VERIFIER_KEY);
      sessionStorage.removeItem('turnstile_auth_token');
      return;
    }

    try {
      let tokens;
      if (provider === 'google') {
        const { NEXUS_URL, AUTH } = config;
        const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        const redirectUri = isLocal
          ? (AUTH.LOCAL_REDIRECT_URI || 'https://localhost:3000')
          : AUTH.REDIRECT_URI;
        const response = await this._fetchWithTimeout(`${NEXUS_URL}/tool/exchange_google_code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, code_verifier: verifier, redirect_uri: redirectUri, turnstile_token: turnstileToken })
        }, 15000);
        if (!response.ok) throw await this._httpError(response, 'Token exchange failed');
        const result = await response.json();
        if (!result.ok) throw this._apiError(result, 'Token exchange failed');
        tokens = result.data;
      } else {
        // Legacy Cognito flow — the token endpoint accepts PKCE directly
        const { USER_POOL_DOMAIN, CLIENT_ID, REDIRECT_URI } = this._getConfig();
        const response = await fetch(`https://${USER_POOL_DOMAIN}/oauth2/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: CLIENT_ID,
            code,
            redirect_uri: REDIRECT_URI,
            code_verifier: verifier
          })
        });
        if (!response.ok) throw await this._httpError(response, 'Cognito exchange failed');
        tokens = await response.json();
      }

      localStorage.removeItem(PKCE_VERIFIER_KEY);
      // PROVIDER_KEY stays — _refreshToken() needs it to route the refresh.
      this._tokens = this._bundle(tokens, null);
      this._persistTokens();
      this._installUser();
      log.info('Auth successful', { email: this._user?.email, provider: provider || 'cognito' });
      // Router resumes any pending destination via localStorage in init()
    } catch (err) {
      log.error('OAuth callback failed', err);
      state.notify('Login failed. Please try again.', 'error');
    } finally {
      sessionStorage.removeItem('turnstile_auth_token');
    }
  },

  /** Single-flight wrapper: concurrent callers await the same refresh. */
  _refresh() {
    this._refreshing ??= this._refreshToken().finally(() => { this._refreshing = null; });
    return this._refreshing;
  },

  async _refreshToken() {
    if (!this._tokens?.refreshToken) return false;

    const provider = localStorage.getItem(PROVIDER_KEY);
    const isGoogle = provider === 'google' || !this._getConfig().USER_POOL_DOMAIN;

    try {
      let tokens;
      if (isGoogle) {
        // Routed through the worker — it holds GOOGLE_CLIENT_SECRET
        const { NEXUS_URL } = config;
        const response = await this._fetchWithTimeout(`${NEXUS_URL}/tool/refresh_google_token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: this._tokens.refreshToken })
        }, 12000);
        if (!response.ok) throw await this._httpError(response, 'Refresh request failed');
        const result = await response.json();
        if (!result.ok) throw this._apiError(result, 'Refresh failed');
        tokens = result.data;
      } else {
        const { USER_POOL_DOMAIN, CLIENT_ID } = this._getConfig();
        const response = await fetch(`https://${USER_POOL_DOMAIN}/oauth2/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: CLIENT_ID,
            refresh_token: this._tokens.refreshToken
          })
        });
        if (!response.ok) throw await this._httpError(response, 'Cognito refresh failed');
        tokens = await response.json();
      }

      this._tokens = this._bundle(tokens, this._tokens);
      this._persistTokens();
      this._installUser();
      log.info('Silent refresh successful');
      return true;
    } catch (err) {
      if (isRefreshRejected(err)) {
        // Explicit rejection (401 / invalid_grant) — the refresh token is dead.
        log.warn('Refresh token rejected — clearing session', err);
        this._clear();
        state.set('user', null);
      } else {
        // Transient (5xx, network, timeout): keep the session, try again shortly.
        log.warn('Silent refresh failed — keeping session, will retry', err);
        this._scheduleRefresh(REFRESH_RETRY_MS);
      }
      return false;
    }
  },

  /**
   * Normalize a provider token response into the stored bundle. A refresh response
   * usually OMITS refresh_token — carry the previous one forward; a rotated one wins.
   */
  _bundle(tokens, prev) {
    const bundle = {
      accessToken: tokens.access_token,
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token || prev?.refreshToken || null,
      expiresAt: Date.now() + ((Number(tokens.expires_in) || 3600) * 1000)
    };
    // Optional claims the worker may attach alongside the tokens
    if (tokens.admin != null) bundle.admin = !!tokens.admin;
    else if (prev?.admin != null) bundle.admin = prev.admin;
    if (tokens.role) bundle.role = tokens.role; else if (prev?.role) bundle.role = prev.role;
    if (tokens.tier) bundle.tier = tokens.tier; else if (prev?.tier) bundle.tier = prev.tier;
    return bundle;
  },

  _persistTokens() {
    this._s.setItem(STORAGE_KEY, JSON.stringify(this._tokens));
  },

  /**
   * Parse the id_token into the user, backfill lean-token gaps from the in-memory
   * user and the persisted profile, publish to state, warm the avatar, and arm the
   * keep-alive. The ONE place a user is installed — callback, restore and refresh.
   */
  _installUser() {
    const parsed = this._parseIdToken(this._tokens?.idToken);
    const user = hydrateProfile(parsed, this._user, this._readProfile());
    this._applyTokenClaimsToUser(user);
    this._user = user;
    if (user?.sub) this._writeProfile(user);
    state.set('user', user);
    this._cacheUserAvatar(user);
    this._scheduleRefresh();
    return user;
  },

  _applyTokenClaimsToUser(user) {
    if (!user) return user;
    if (this._tokens?.admin != null) user.admin = !!this._tokens.admin;
    if (this._tokens?.role) user.role = this._tokens.role;
    if (this._tokens?.tier) user.tier = this._tokens.tier;
    return user;
  },

  _readProfile() {
    try { return JSON.parse(this._s.getItem(PROFILE_KEY) || 'null'); } catch { return null; }
  },

  _writeProfile({ sub, email, name, picture }) {
    try { this._s.setItem(PROFILE_KEY, JSON.stringify({ sub, email, name, picture })); } catch { /* quota */ }
  },

  _parseIdToken(idToken) {
    try {
      const payload = idToken.split('.')[1];
      // JWT uses base64url (- and _); atob requires standard base64
      return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return null;
    }
  },

  // Proactive refresh: ONE timer at the leading edge of the refresh window (never a
  // polling interval), plus a visibilitychange hook for laptop sleep / long idle
  // where timers were throttled. Re-armed on every token install.
  _scheduleRefresh(delayMs) {
    clearTimeout(this._refreshTimer);
    this._refreshTimer = null;
    if (!this._keepAlive || !this._tokens?.refreshToken) return;
    const ms = delayMs ?? refreshDelayMs(this._tokens.expiresAt, Date.now(), REFRESH_WINDOW_MS);
    if (ms == null) return;
    this._refreshTimer = setTimeout(() => { this._refresh().catch(() => {}); }, ms);
    if (!this._onVisible) {
      this._onVisible = () => {
        if (document.visibilityState === 'visible') this.checkAndRefresh().catch(() => {});
      };
      document.addEventListener('visibilitychange', this._onVisible);
    }
  },

  _stopKeepAlive() {
    clearTimeout(this._refreshTimer);
    this._refreshTimer = null;
    if (this._onVisible) {
      document.removeEventListener('visibilitychange', this._onVisible);
      this._onVisible = null;
    }
  },

  async _cacheUserAvatar(user) {
    if (!user?.picture) return;
    // Stable URL (size pinned) + identity key: Google rotates the picture URL on its
    // own schedule, and a URL-keyed cache re-fetched (and 429'd) on every rotation.
    const url = normalizeAvatarUrl(user.picture);
    const key = user.sub || url;
    try {
      const cached = JSON.parse(this._s.getItem(AVATAR_KEY) || 'null');
      if (cached?.key === key && cached.data) return; // Already cached
    } catch { /* corrupt, re-fetch */ }
    try {
      // lh3.googleusercontent.com rate-limits by Referer — send none.
      const res = await fetch(url, { referrerPolicy: 'no-referrer' });
      if (!res.ok) { log.warn('Avatar fetch failed:', res.status); return; }
      const blob = await res.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      this._s.setItem(AVATAR_KEY, JSON.stringify({ key, url, data: dataUrl }));
      log.debug('Avatar cached');
      // Trigger re-render of nav so the avatar appears
      state.set('user', { ...this._user });
    } catch (e) {
      log.warn('Avatar cache failed:', e);
    }
  },

  _clear() {
    this._stopKeepAlive();
    this._tokens = null;
    this._user = null;
    for (const k of IDENTITY_KEYS) this._s.removeItem(k);
    for (const k of [PKCE_VERIFIER_KEY, STATE_KEY]) localStorage.removeItem(k);
  },

  _getConfig() {
    const authConfig = config.AUTH || {};
    const isLocalHost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    return {
      USER_POOL_DOMAIN: authConfig.USER_POOL_DOMAIN || '',
      CLIENT_ID: authConfig.CLIENT_ID || '',
      GOOGLE_CLIENT_ID: authConfig.GOOGLE_CLIENT_ID || '',
      REDIRECT_URI: isLocalHost
        ? (authConfig.LOCAL_REDIRECT_URI || 'https://localhost:3000')
        : (authConfig.REDIRECT_URI || window.location.origin)
    };
  },

  async _fetchWithTimeout(url, options, ms) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  },

  /** HTTP failure → Error carrying `.status` and the OAuth `.code` (body.error) for isRefreshRejected(). */
  async _httpError(response, fallback) {
    const body = await response.json().catch(() => ({}));
    const err = new Error(body.error_description || body.error || `${fallback}: ${response.status}`);
    err.status = response.status;
    err.code = typeof body.error === 'string' ? body.error : undefined;
    return err;
  },

  /** Worker envelope `{ ok:false, error }` → Error carrying `.code` (the worker maps a dead refresh token to 'invalid_grant'). */
  _apiError(result, fallback) {
    const err = new Error(result.error || fallback);
    err.code = typeof result.error === 'string' ? result.error : undefined;
    return err;
  }
};
