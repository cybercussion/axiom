/**
 * Project Axiom: Auth helpers
 * PURE functions only — no imports, no DOM, no state. Everything here runs in node
 * (tools/auth-helpers.test.js) and in the browser unchanged. auth.js composes these;
 * downstream projects with their own session models can compose them differently.
 */

const S256 = 'S256';
const DEFAULT_SCOPES = 'openid profile email';
const TIMER_MAX_MS = 2147483647; // setTimeout ceiling (2^31 - 1)
const SOON_MS = 1000;

/** Base64url (RFC 4648 §5) without padding. */
export function base64UrlEncode(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 32 CSPRNG bytes → 43-char base64url. Also used for OAuth `state`. */
export function generateCodeVerifier() {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

/** PKCE S256 challenge for a verifier. */
export async function generateCodeChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Authorization-request URL: code flow + PKCE S256 + state. `extra` carries the
 * provider-specific params (Google: access_type/prompt; Cognito: identity_provider).
 * `state` is REQUIRED — a login without CSRF correlation is not expressible here.
 */
export function buildAuthorizeUrl({ authorizationEndpoint, clientId, redirectUri, scopes, challenge, state, extra = {} }) {
  if (!state) throw new Error('buildAuthorizeUrl: state is required');
  const u = new URL(authorizationEndpoint);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('scope', scopes || DEFAULT_SCOPES);
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', S256);
  u.searchParams.set('state', state);
  for (const [k, v] of Object.entries(extra)) if (v != null) u.searchParams.set(k, String(v));
  return u.toString();
}

/**
 * Backfill profile claims a lean token omits. Google's refresh-grant id_token carries
 * only sub/email/exp — re-parsing it blanks name + picture. Precedence: the parsed
 * token, then the in-memory user, then the persisted last-known-good profile. A
 * cache is only consulted when it belongs to the SAME `sub`.
 */
export function hydrateProfile(user, prev, stored) {
  if (!user) return user;
  const out = { ...user };
  for (const src of [prev, stored]) {
    if (!src || src.sub !== out.sub) continue;
    if (!out.name && src.name) out.name = src.name;
    if (!out.picture && src.picture) out.picture = src.picture;
    if (!out.email && src.email) out.email = src.email;
  }
  return out;
}

/**
 * Pin a Google avatar to a small fixed size. Google varies the size suffix between
 * tokens, which busted URL-keyed caches; a stable URL is a stable cache key and a
 * small payload. Non-Google URLs pass through untouched.
 */
export function normalizeAvatarUrl(url) {
  if (!url) return url;
  return /=s\d+(-c)?$/.test(url) ? url.replace(/=s\d+(-c)?$/, '=s96-c') : url;
}

/**
 * The refresh-rejection contract. A session is cleared ONLY when the refresh endpoint
 * explicitly rejects the refresh token: HTTP 401, or an OAuth error code of
 * `invalid_grant` (RFC 6749 §5.2 — what Cognito/Google return on a revoked token).
 * Transient failures (5xx, network, timeout, abort) keep the session; the next tick
 * retries. Message substrings are deliberately NOT consulted.
 */
export function isRefreshRejected(err) {
  if (!err) return false;
  if (err.status === 401) return true;
  return err.code === 'invalid_grant';
}

/**
 * Delay until the proactive refresh should fire: `lead` ms before expiry, clamped to
 * [SOON, setTimeout max]. null when there is no usable expiry (nothing to schedule).
 */
export function refreshDelayMs(expiresAt, now = Date.now(), lead = 5 * 60 * 1000) {
  if (typeof expiresAt !== 'number' || Number.isNaN(expiresAt)) return null;
  return Math.min(Math.max(expiresAt - now - lead, SOON_MS), TIMER_MAX_MS);
}
