/**
 * Post-sign-in destination handoff. The router saves where a signed-out visitor
 * was going, and resumes it after the OAuth round trip lands back on the app.
 *
 * A saved destination is only honored when the app has just landed from sign-in
 * (OAuth returns to the root; the login feature then routes to /home) and only
 * while it is fresh. Without both checks, an abandoned sign-in left a destination
 * in storage that hijacked the user's NEXT visit, including a deep link opened
 * days later. Reconciled from scobot (Arc intent 48).
 */

export const REDIRECT_KEY = 'axiom_auth_redirect';
// Covers the whole OAuth round trip, including slow 2FA/consent screens.
export const REDIRECT_TTL_MS = 30 * 60 * 1000;
const LANDING_PATHS = ['/', '/login', '/home'];

export function saveRedirect(storage, path, now = Date.now()) {
  storage.setItem(REDIRECT_KEY, JSON.stringify({ path, at: now }));
}

/**
 * The app-internal form of a location pathname: deploy base stripped, leading
 * slash, no trailing slash, /index(.html) → /. Mirrors router.navigate's cleanPath.
 */
export function landingPath(pathname, base = '/') {
  let p = pathname || '/';
  if (base && base !== '/' && (p === base.replace(/\/+$/, '') || p.startsWith(base))) {
    p = p.slice(base.replace(/\/+$/, '').length);
  }
  if (!p.startsWith('/')) p = '/' + p;
  p = p.replace(/\/+$/, '') || '/';
  return p === '/index.html' || p === '/index' ? '/' : p;
}

/**
 * Always clears the stored value; returns the path to resume, or null.
 * `landings` adds app-specific sign-in landings (the router passes its loginPath).
 */
export function takeRedirect(storage, pathname, now = Date.now(), ttlMs = REDIRECT_TTL_MS, base = '/', landings = []) {
  const raw = storage.getItem(REDIRECT_KEY);
  if (raw == null) return null;
  storage.removeItem(REDIRECT_KEY);
  const here = landingPath(pathname, base);
  if (!LANDING_PATHS.includes(here) && !landings.some((l) => landingPath(l) === here)) return null;

  let path = null;
  let at = null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.path === 'string') ({ path, at } = parsed);
  } catch { /* pre-2026-10-03 builds stored the bare path string */ }
  if (path == null) path = raw; // legacy bare string: no timestamp, landing check only
  else if (typeof at !== 'number' || now - at > ttlMs || now < at) return null;

  // Same-origin app paths only — never resume to another origin or a protocol URL.
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return null;
  return path;
}
