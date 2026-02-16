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
          state.set('user', this._user);
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

  /**
   * Check if user has admin role.
   */
  isAdmin() {
    const groups = this._user?.['cognito:groups'] || [];
    return groups.includes('admin') || groups.includes('teacher');
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
    await this.checkAndRefresh();
    return this._tokens?.accessToken;
  },

  /**
   * Get current user info.
   */
  getUser() {
    return this._user;
  },

  /**
   * Initiate OAuth login with specified provider.
   * @param {string} provider - 'Google', 'Facebook', or custom IDP
   */
  async loginWith(provider = 'Google') {
    const { USER_POOL_DOMAIN, CLIENT_ID, REDIRECT_URI } = this._getConfig();

    // Generate PKCE challenge
    const verifier = this._generateCodeVerifier();
    const challenge = await this._generateCodeChallenge(verifier);
    localStorage.setItem(PKCE_VERIFIER_KEY, verifier);

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

    // Cognito logout endpoint
    const logoutUrl = new URL(`https://${USER_POOL_DOMAIN}/logout`);
    logoutUrl.searchParams.set('client_id', CLIENT_ID);
    logoutUrl.searchParams.set('logout_uri', REDIRECT_URI);

    window.location.href = logoutUrl.toString();
  },

  // --- Private Methods ---

  async _handleCallback(code) {
    const { USER_POOL_DOMAIN, CLIENT_ID, REDIRECT_URI } = this._getConfig();
    const verifier = localStorage.getItem(PKCE_VERIFIER_KEY);

    if (!verifier) {
      log.error('No PKCE verifier found');
      return;
    }

    try {
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

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.status}`);
      }

      const tokens = await response.json();
      localStorage.removeItem(PKCE_VERIFIER_KEY);

      this._tokens = {
        accessToken: tokens.access_token,
        idToken: tokens.id_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + (tokens.expires_in * 1000)
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._tokens));

      this._user = this._parseIdToken(tokens.id_token);
      state.set('user', this._user);

      log.info('Auth successful', { email: this._user?.email });

      // Router will handle redirect via localStorage lookup in init()

    } catch (err) {
      log.error('OAuth callback failed', err);
      state.notify('Login failed. Please try again.', 'error');
    }
  },

  async _refreshToken() {
    const { USER_POOL_DOMAIN, CLIENT_ID } = this._getConfig();
    if (!this._tokens?.refreshToken) return false;

    try {
      const response = await fetch(`https://${USER_POOL_DOMAIN}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: CLIENT_ID,
          refresh_token: this._tokens.refreshToken
        })
      });

      if (!response.ok) {
        throw new Error(`Refresh failed: ${response.status}`);
      }

      const tokens = await response.json();

      // Update tokens while preserving the refresh_token (Cognito might not return a new one)
      this._tokens = {
        ...this._tokens,
        accessToken: tokens.access_token,
        idToken: tokens.id_token,
        expiresAt: Date.now() + (tokens.expires_in * 1000)
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._tokens));
      log.info('Silent refresh successful');
      return true;
    } catch (err) {
      log.error('Silent refresh failed', err);
      this._clear();
      state.set('user', null);
      return false;
    }
  },

  _parseIdToken(idToken) {
    try {
      const payload = idToken.split('.')[1];
      return JSON.parse(atob(payload));
    } catch {
      return null;
    }
  },

  _clear() {
    this._tokens = null;
    this._user = null;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PKCE_VERIFIER_KEY);
  },

  _getConfig() {
    const authConfig = config.AUTH || {};
    return {
      USER_POOL_DOMAIN: authConfig.USER_POOL_DOMAIN || '',
      CLIENT_ID: authConfig.CLIENT_ID || '',
      REDIRECT_URI: authConfig.REDIRECT_URI || window.location.origin
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
