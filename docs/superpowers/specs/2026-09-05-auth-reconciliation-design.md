# Auth reconciliation — promote the live projects' reload fixes into the template

**Date:** 2026-09-05 · **Status:** approved (Mark, this session) · **Scope:** `src/core/auth.js` + pure helpers, `tools/check-pwa.js`, PWA service-worker template, GitHub Pages deploy workflow.

## Problem

`src/core/auth.js` in axiom is a March 2026 copy. Since then every live Axiom
project fixed "Google auth doesn't survive a reload" independently and differently
(three projects, 06-19 through 07-03) and none of it flowed back. One still runs the
unfixed file. The symptom has four separate causes:

1. A **refreshed Google id_token is lean** (no `name`/`picture`) → avatar and name blank after a refresh or a reload from a refreshed token.
2. The **route guard only checks `expiresAt`** and nothing refreshes proactively → an idle or reloaded tab near expiry bounces to `/login` despite a valid refresh token.
3. A **transient refresh error clears the session**: any error message containing `400`/`401` as a substring logs the user out.
4. **Avatar fetch churn**: Google 429s by Referer and rotates the picture URL, so the cache misses and the image fails after reload.

Two gaps nobody closed: concurrent `getAccessToken()` calls race the refresh (no single-flight on the Google path anywhere), and the Google flow sends no OAuth `state`.

## Non-goals (axiom stays semi-unopinionated)

- No provider-specific session model (an LTI session token, a project's own key namespace — both stay downstream).
- No opinion on token storage (localStorage stays; HttpOnly cookies are a fleet/backend decision).
- No CSP or header policy beyond the existing `_headers` template.
- The showcase does not use auth; nothing here changes runtime behavior of axiom's own deploy.

## Design

### `src/core/auth-helpers.js` — pure, zero-import, node-testable
`buildAuthorizeUrl`, `generateCodeVerifier`, `generateCodeChallenge`, `base64UrlEncode`,
`hydrateProfile(user, prev, stored)`, `normalizeAvatarUrl`, `isRefreshRejected(err)`,
`refreshDelayMs(expiresAt, now, lead)`. Tested from `tools/auth-helpers.test.js` so the
existing `npm run test:tools` gate covers them without touching the build.

### `src/core/auth.js`
- **Profile persistence**: `axiom_profile` (last-known-good `sub/email/name/picture`); every user install runs `hydrateProfile(parsed, previousInMemory, stored)` and re-persists.
- **Keep-alive**: after any token install, schedule ONE refresh at the leading edge of the 10-minute refresh window (clamped) and refresh on `visibilitychange → visible`. No polling. Stopped by `_clear()`.
- **Single-flight**: `checkAndRefresh()` shares one in-flight promise across concurrent callers.
- **Rejection contract**: the session is cleared only when the refresh response is HTTP `401` or carries `error: "invalid_grant"` (status/field, not message substrings). Anything else keeps the session and retries at the next tick. Worker contract documented in `docs/auth-readme.md`.
- **OAuth `state`**: generated per login, stored in `axiom_oauth_state`, sent on Google and Cognito, validated (and cleared) before exchange.
- **Avatar**: `referrerPolicy: 'no-referrer'`, Google size suffix pinned to `=s96-c`, cache keyed on `sub` (URL fallback when no `sub`).
- Route guards remain the app's choice; `docs/auth-readme.md` shows `guard: () => auth.checkAndRefresh()`.

### PWA
- `tools/check-pwa.js`: neither `manifest.json` nor `sw.js` present → "not a PWA, opt in with `create-seo --pwa`", exit 0. Exactly one present → fail as before.
- `tools/templates/sw.js` (ev's worker, generalized): network-first navigations, stale-while-revalidate assets, never caches same-origin API prefixes, cache name stamped `__BUILD_ID__`. `create-seo --pwa` writes it when absent and prints the registration snippet. `tools/minify.js` stamps the build id when copying `sw.js`.

### Deploy (GitHub Pages)
Absolute import-map addresses resolve against the domain root, so under `/axiom/` every
core module 503s (live since 2026-07-10, verified in Chrome 2026-09-05). The workflow now
rewrites `"/src/` → `"/axiom/src/` alongside the base tag, and runs `npm ci`, lint and
`test:tools` before uploading. Source (not `dist/`) is still what deploys: zero-build is the thesis.

### Dashboard
`Retry Uplink` binds its handler from the component (inline `onclick` referenced a module
binding that is not a global; its `src/` path would also break in `dist/`).

## Acceptance
- `npm run lint`, `npm run test:tools` (new helper tests included), `npm run build && npm run verify-dist` pass.
- `npm run check-pwa` exits 0 on axiom with the not-a-PWA notice.
- Live `cybercussion.github.io/axiom/components` renders after deploy (network tab shows `/axiom/src/core/*.js` 200).
- Downstream pull instructions in `docs/auth-readme.md` name what each project keeps local.
