# Production hardening review — 2026-09-05

## Scope and method

Focused review of the browser core (`auth`, `router`, `gateway`, `state`), build/release path, and delivery headers. This was a code review, not a penetration test or an audit of the API/identity-provider configuration.

Validated locally:

- `npm run lint` — passed
- `npm run test:tools` — passed (13 tests)
- `npm run build && npm run verify-dist` — passed
- `npm run check-pwa` — failed because `manifest.json` and `sw.js` are absent

## Findings

### P1 — The production deployment bypasses all build and verification gates

The GitHub Pages workflow uploads `.` directly and only rewrites the base tag. It does not install dependencies or run lint, tests, build, `verify-dist`, or `check-pwa` ([deploy workflow](../.github/workflows/deploy.yml#L30-L40)). Consequently, the locally verified `dist/` artifact is never what is deployed, and a broken source edit can reach production even if the build checks would have caught it.

**Recommendation:** make the workflow reproducible: `npm ci`, then lint/tests/build/verification, and upload only `dist/`. Fail the workflow for missing required release assets.

### P1 — Runtime production configuration has no shipped configuration source and falls back to placeholder API hosts

Core configuration reads only `window.AXIOM_CONFIG`, but the tracked HTML has no script or injected configuration that defines it ([config](../src/core/config.js#L7-L30), [HTML](../index.html#L4-L53)). With no injection at the host, production falls back to `https://api.yourdomain.com` for REST and Nexus. Authentication and API calls will therefore fail or can be unintentionally sent to the wrong origin if a deployment misses configuration.

**Recommendation:** add a versioned, deployment-generated public runtime-config file before the application modules, validate required production values at boot, and fail closed with a clear non-secret configuration error. Remove placeholder production endpoints from release defaults.

### P1 — Intended browser security headers are not effective on the actual GitHub Pages deployment

`_headers` contains only the intended header policy and explicitly documents that it is a no-op on GitHub Pages ([headers](../_headers#L1-L28)). The release workflow deploys to GitHub Pages ([deploy workflow](../.github/workflows/deploy.yml#L1-L40)), so `X-Frame-Options`, `X-Content-Type-Options`, and the referrer policy are not enforced there. There is no Content-Security-Policy anywhere in the delivery configuration.

This matters more because browser-held OAuth tokens are persisted in `localStorage` ([auth](../src/core/auth.js#L42-L63), [auth](../src/core/auth.js#L293-L297)). Any same-origin script injection can read and exfiltrate the access and refresh tokens.

**Recommendation:** place production behind a host/CDN/Worker that enforces security headers and a restrictive CSP (including `frame-ancestors 'none'`, explicit `connect-src`, and tightly scoped script sources). Prefer a backend-managed, `HttpOnly`, `Secure`, `SameSite` session over long-lived refresh tokens accessible to JavaScript.

### P2 — OAuth callback correlation is incomplete

Both OAuth authorization requests send PKCE fields but no `state` value ([auth](../src/core/auth.js#L138-L172)). The callback accepts any `code` query parameter and does not validate a per-login `state` value before exchanging it ([auth](../src/core/auth.js#L202-L275)). PKCE is valuable and reduces code interception risk, but it is not a replacement for explicit OAuth response/CSRF correlation.

**Recommendation:** generate a cryptographically random `state`, keep it in `sessionStorage` with a short expiry, send it with each authorization request, compare it in constant-time on the callback, and clear it before token exchange. Store the PKCE verifier in `sessionStorage` as well.

### P2 — Concurrent requests can race token refresh

Every gateway call calls `auth.getAccessToken()` ([gateway](../src/core/gateway.js#L21-L23), [gateway](../src/core/gateway.js#L83-L84)). When a token is within the ten-minute refresh window, each call independently invokes `_refreshToken()`; there is no shared in-flight refresh promise or lock ([auth](../src/core/auth.js#L91-L108), [auth](../src/core/auth.js#L311-L391)). A burst of page/API requests can therefore redeem the same refresh token multiple times. If the provider rotates refresh tokens, later requests may fail and the code may clear an otherwise-valid session on a 400/401.

**Recommendation:** single-flight refreshes per browser context, update the refresh token when one is returned, and coordinate across tabs if multi-tab use is supported. Preserve the original failure cause rather than treating all 400/401 responses as an invalid refresh token.

### P2 — Dashboard recovery control cannot work in the deployed module model

The dashboard error UI embeds an inline `onclick` handler that references `state`, but `state` is an ES-module import and is not a global (`window.state`) ([dashboard](../src/features/dashboard/dashboard.js#L52-L63)). On an error, clicking **Retry Uplink** raises `ReferenceError: state is not defined`; its dynamic import also uses the source-only `src/features/...` path, which would be wrong in `dist/`.

**Recommendation:** bind the click listener from the component, call the imported `state` binding directly, and reuse the route API function rather than spelling a separate import path in HTML. Add an error-state interaction test.

### P3 — PWA release contract is broken and the build hides missing release files

The repository has a PWA validator that requires `manifest.json`, `sw.js`, a manifest link, and service-worker registration ([PWA check](../tools/check-pwa.js#L31-L95)), but neither required file exists and the validator fails. The build nevertheless reports success because `copyFile()` silently skips missing files ([build copy](../tools/minify.js#L205-L214), [copy implementation](../tools/minify.js#L426-L432)).

**Recommendation:** either remove the stale PWA contract and script, or restore the assets/registration and make them required build inputs. Do not silently omit declared release artifacts.

## Suggested remediation order

1. Fix the CI/CD artifact path and validate/inject runtime configuration.
2. Put the app behind an origin that can enforce CSP and the other security headers; decide on a server-managed session design.
3. Add OAuth `state` validation and refresh single-flight handling.
4. Repair the dashboard retry action and make the PWA contract truthful.
