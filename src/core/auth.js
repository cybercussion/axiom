/**
 * Project Axiom: Auth Service
 * Lightweight Cognito OAuth2 + PKCE wrapper.
 * Zero-dependency, zero-build.
 */
import { state } from '@state';
import { config } from '@core/config.js';
import { log } from '@core/logger.js';

const STORAGE_KEY = 'axiom_auth';
const PKCE_VERIFIER_KEY = 'axiom_pkce_verifier';

export const auth = {
  _tokens: null,
  _user: null,

  _applyTokenClaimsToUser(user = this._user) {
    if (!user) return user;
    if (this._tokens?.admin != null) user.admin = !!this._tokens.admin;
    if (this._tokens?.role) user.role = this._tokens.role;
    if (this._tokens?.tier) user.tier = this._tokens.tier;
    return user;
  },

  /**
   * Initialize auth state from storage or handle OAuth callback.
   * Call this BEFORE router.init().
   */
  async init() {
    // Check for OAuth callback
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      await this._handleCallback(code);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    // Hydrate from storage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        this._tokens = data;

        // Attempt silent refresh if needed
        const isValid = await this.checkAndRefresh();

        if (isValid) {
          this._user = this._parseIdToken(this._tokens.idToken);
          this._applyTokenClaimsToUser(this._user);
          state.set('user', this._user);
          this._cacheUserAvatar(this._user);
          log.info('Auth restored from session (refreshed if needed)');
        } else {
          log.warn('Session expired and refresh failed');
          this._clear();
        }
      } catch (e) {
        log.error('Failed to parse stored auth', e);
        this._clear();
      }
    }
  },

  /**
   * Check if user is authenticated.
   */
  isAuthenticated() {
    return !!this._tokens && this._tokens.expiresAt > Date.now();
  },

  /** Alias for isAuthenticated — preferred for readability in UI code */
  isLoggedIn() {
    return this.isAuthenticated();
  },

  /**
   * Check if user has admin role.
   */
  isAdmin() {
    return !!(this._user?.admin || this._user?.is_admin || this._user?.teacher);
  },

  /**
   * Ensure token is valid, refreshing if necessary.
   * Call this BEFORE any authenticated API requests.
   */
  async checkAndRefresh() {
    if (!this._tokens) return false;

    // Buffer: If less than 10 mins remaining, refresh.
    const threshold = 10 * 60 * 1000;
    const isExpiring = Date.now() + threshold > this._tokens.expiresAt;

    if (isExpiring) {
      if (this._tokens.refreshToken) {
        log.info('Token expiring soon, attempting silent refresh...');
        return await this._refreshToken();
      } else {
        log.warn('Token expiring and no refresh token available');
        return false;
      }
    }

    return true;
  },

  /**
   * Get the current Access Token, ensuring it is fresh.
   */
  async getAccessToken() {
    const valid = await this.checkAndRefresh();
    return valid ? this._tokens?.accessToken : null;
  },

  /**
   * Get the current ID Token (JWT), ensuring it is fresh.
   */
  async getIdToken() {
    const valid = await this.checkAndRefresh();
    return valid ? this._tokens?.idToken : null;
  },

  /**
   * Get current user info.
   */
  getUser() {
    return this._user;
  },

  /**
   * Initiate OAuth login with specified provider.
   * @param {string} provider - 'Google', 'Facebook', or 'DirectGoogle'
   */
  async loginWith(provider = 'Google') {
    const { USER_POOL_DOMAIN, CLIENT_ID, GOOGLE_CLIENT_ID, REDIRECT_URI } = this._getConfig();

    // Generate PKCE challenge
    const verifier = this._generateCodeVerifier();
    const challenge = await this._generateCodeChallenge(verifier);
    localStorage.setItem(PKCE_VERIFIER_KEY, verifier);

    // Pivot: Direct Google Auth (Cloudflare Migration)
    if (provider === 'DirectGoogle' || (GOOGLE_CLIENT_ID && !USER_POOL_DOMAIN)) {
      localStorage.setItem('axiom_auth_provider', 'google');
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid profile email');
      authUrl.searchParams.set('code_challenge', challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('access_type', 'offline');  // Required for refresh_token
      authUrl.searchParams.set('prompt', 'consent');        // Forces consent → guarantees refresh_token
      window.location.href = authUrl.toString();
      return;
    }

    // Legacy: Cognito Auth
    const authUrl = new URL(`https://${USER_POOL_DOMAIN}/oauth2/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('identity_provider', provider);
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    window.location.href = authUrl.toString();
  },

  /**
   * Log out and clear session.
   */
  async logout() {
    const { USER_POOL_DOMAIN, CLIENT_ID, REDIRECT_URI } = this._getConfig();

    this._clear();
    state.set('user', null);

    // Clear session context so the next user who logs in starts fresh
    localStorage.removeItem('axiom-sessionId');
    state.set('sessionId', null);

    // Only use Cognito logout if Cognito is configured
    if (USER_POOL_DOMAIN) {
      const logoutUrl = new URL(`https://${USER_POOL_DOMAIN}/logout`);
      logoutUrl.searchParams.set('client_id', CLIENT_ID);
      logoutUrl.searchParams.set('logout_uri', REDIRECT_URI);
      window.location.href = logoutUrl.toString();
    } else {
      // Direct Google / Cloudflare path — navigate to root; router guard redirects to /login
      window.location.href = '/';
    }
  },

  // --- Private Methods ---

  async _handleCallback(code) {
    const { USER_POOL_DOMAIN, CLIENT_ID, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI } = this._getConfig();
    const verifier = localStorage.getItem(PKCE_VERIFIER_KEY);
    const provider = localStorage.getItem('axiom_auth_provider');
    const turnstileToken = sessionStorage.getItem('turnstile_auth_token');

    if (!verifier) {
      log.error('No PKCE verifier found — session may have opened in a different browser context');
      state.notify('Login session expired. Please try again.', 'error');
      return;
    }

    try {
      if (provider === 'google') {
        const { NEXUS_URL, AUTH } = config;
        const nexusUrl = NEXUS_URL || 'https://api.daystra.com';
        const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        const redirectUri = isLocal
          ? (AUTH.LOCAL_REDIRECT_URI || 'https://localhost:3000')
          : AUTH.REDIRECT_URI;
        const endpoint = `${nexusUrl}/tool/exchange_google_code`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        let response;
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              code_verifier: verifier,
              redirect_uri: redirectUri,
              turnstile_token: turnstileToken
            }),
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeout);
        }

        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.error || `Token exchange failed: ${response.status}`);
        }

        const result = await response.json();
        if (!result.ok) throw new Error(result.error);

        const tokens = result.data;
        localStorage.removeItem(PKCE_VERIFIER_KEY);
        // Keep axiom_auth_provider — _refreshToken() needs it to route to Google vs Cognito

        this._tokens = {
          accessToken: tokens.access_token,
          idToken: tokens.id_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + (tokens.expires_in * 1000)
        };
        if (tokens.admin != null) this._tokens.admin = !!tokens.admin;
        if (tokens.role) this._tokens.role = tokens.role;
        if (tokens.tier) this._tokens.tier = tokens.tier;
      } else {
        // Legacy Cognito Flow
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

        if (!response.ok) throw new Error(`Cognito exchange failed: ${response.status}`);

        const tokens = await response.json();
        localStorage.removeItem(PKCE_VERIFIER_KEY);

        this._tokens = {
          accessToken: tokens.access_token,
          idToken: tokens.id_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + (tokens.expires_in * 1000)
        };
        if (tokens.admin) this._tokens.admin = true;
        if (tokens.role) this._tokens.role = tokens.role;
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._tokens));
      this._user = this._parseIdToken(this._tokens.idToken);
      this._applyTokenClaimsToUser(this._user);
      state.set('user', this._user);
      this._cacheUserAvatar(this._user);

      log.info('Auth successful', { email: this._user?.email, provider: provider || 'cognito' });

      // Router will handle redirect via localStorage lookup in init()

    } catch (err) {
      log.error('OAuth callback failed', err);
      state.notify('Login failed. Please try again.', 'error');
    } finally {
      sessionStorage.removeItem('turnstile_auth_token');
    }
  },

  async _refreshToken() {
    if (!this._tokens?.refreshToken) return false;

    const provider = localStorage.getItem('axiom_auth_provider');
    const isGoogle = provider === 'google' || !this._getConfig().USER_POOL_DOMAIN;

    try {
      if (isGoogle) {
        // Route through Nexus — it has GOOGLE_CLIENT_SECRET
        const { NEXUS_URL } = config;
        const endpoint = `${NEXUS_URL}/tool/refresh_google_token`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        let response;
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: this._tokens.refreshToken }),
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeout);
        }

        if (!response.ok) throw new Error(`Refresh request failed: ${response.status}`);
        const result = await response.json();
        if (!result.ok) throw new Error(result.error || 'Refresh failed');

        const tokens = result.data;
        this._tokens = {
          ...this._tokens,
          accessToken: tokens.access_token,
          idToken: tokens.id_token,
          expiresAt: Date.now() + (tokens.expires_in * 1000)
        };
        if (tokens.admin != null) this._tokens.admin = !!tokens.admin;
        if (tokens.role) this._tokens.role = tokens.role;
        if (tokens.tier) this._tokens.tier = tokens.tier;
      } else {
        // Legacy Cognito flow
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

        if (!response.ok) throw new Error(`Cognito refresh failed: ${response.status}`);
        const tokens = await response.json();
        this._tokens = {
          ...this._tokens,
          accessToken: tokens.access_token,
          idToken: tokens.id_token,
          expiresAt: Date.now() + (tokens.expires_in * 1000)
        };
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._tokens));
      this._user = this._parseIdToken(this._tokens.idToken);
      this._applyTokenClaimsToUser(this._user);
      state.set('user', this._user);
      this._cacheUserAvatar(this._user);
      log.info('Silent refresh successful');
      return true;
    } catch (err) {
      log.error('Silent refresh failed', err);
      // Only force logout if the refresh token itself is explicitly rejected.
      // Transient errors (network, Worker cold start, 5xx) should not nuke the session.
      const msg = err.message || '';
      const isTokenInvalid = msg.includes('invalid_grant') || msg.includes('400') || msg.includes('401');
      if (isTokenInvalid) {
        log.warn('Refresh token rejected — clearing session');
        this._clear();
        state.set('user', null);
      }
      return false;
    }
  },

  _parseIdToken(idToken) {
    try {
      const payload = idToken.split('.')[1];
      // JWT uses base64url encoding (- and _ instead of + and /); atob requires standard base64
      return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return null;
    }
  },

  async _cacheUserAvatar(user) {
    if (!user?.picture) return;
    const url = user.picture;
    try {
      const stored = localStorage.getItem('axiom-avatar');
      if (stored) {
        const cached = JSON.parse(stored);
        if (cached.url === url && cached.data) return; // Already cached
      }
    } catch { /* corrupt, re-fetch */ }
    try {
      const res = await fetch(url);
      if (!res.ok) { log.warn('Avatar fetch failed:', res.status); return; }
      const blob = await res.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      localStorage.setItem('axiom-avatar', JSON.stringify({ url, data: dataUrl }));
      log.debug('Avatar cached to localStorage');
      // Trigger re-render of nav so avatar appears
      state.set('user', { ...this._user });
    } catch (e) {
      log.warn('Avatar cache failed:', e);
    }
  },

  _clear() {
    this._tokens = null;
    this._user = null;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PKCE_VERIFIER_KEY);
    localStorage.removeItem('axiom-avatar');
  },

  _getConfig() {
    const authConfig = config.AUTH || {};
    const isLocalHost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    return {
      USER_POOL_DOMAIN: authConfig.USER_POOL_DOMAIN || '',
      CLIENT_ID: authConfig.CLIENT_ID || '',
      GOOGLE_CLIENT_ID: authConfig.GOOGLE_CLIENT_ID || '',
      GOOGLE_CLIENT_SECRET: authConfig.GOOGLE_CLIENT_SECRET || '',
      REDIRECT_URI: isLocalHost
        ? (authConfig.LOCAL_REDIRECT_URI || 'https://localhost:3000')
        : (authConfig.REDIRECT_URI || window.location.origin)
    };
  },

  _generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this._base64UrlEncode(array);
  },

  async _generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return this._base64UrlEncode(new Uint8Array(digest));
  },

  _base64UrlEncode(buffer) {
    return btoa(String.fromCharCode(...buffer))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
};
