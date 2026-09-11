# Security model

Axiom is a browser runtime. This page states what it defends against, how, and what it leaves to the deployment — each claim is checkable against the code it names.

## Threat model

| Threat | What Axiom does | What stays yours |
|---|---|---|
| Cross-site scripting | A deploy-time CSP: `script-src 'self'` plus the import map's hash — no `'unsafe-inline'`, no `eval`. No HTML sinks for untrusted data (`textContent`, `_esc`). CI fails on inline event handlers in `src/`. | Escaping in your own templates; deploying the CSP, as a real header where the host allows it. |
| Token theft | Tokens only in the store you choose (`tokenStore`); the OAuth flow's keys are one-shot; refresh is single-flight. | The token architecture — a backend-for-frontend for anything that matters; lifetimes and rotation at the identity provider. |
| Cross-site request forgery | Bearer tokens travel in headers, not cookies, so nothing ambient can be forged; the OAuth `state` is checked on callback. | CSRF protection for any cookie-authenticated endpoint you add (SameSite plus a token). |
| Clickjacking | `X-Frame-Options: DENY` in `_headers`, on hosts that honour it. | `frame-ancestors`, which needs a real header — a `<meta>` CSP cannot set it, and GitHub Pages sends none. |
| Open redirect | Router navigation is same-origin `pushState` only; the post-login destination is a path, navigated in-app. | Redirects your backend issues. |
| Prototype pollution | The state store has no prototype: `__proto__` and `constructor` are ordinary keys. `mutate()` payload keys become own properties. | Validating untrusted objects you merge yourself. |
| DOM clobbering | Framework lookups are by id on elements it owns (`#app-container`). | Not rendering untrusted markup that carries `id` or `name`. |
| Supply chain | Zero runtime dependencies. Dev tooling is pinned by the lockfile; Dependabot alerts and security updates are on; CodeQL scans every push. | The dependencies you add. |
| Leaked configuration | `axiom-config.js` is declared public. | Never putting a secret in it; authorizing API calls server-side. |

**Axiom does not make your application secure.** It provides security primitives and safe defaults. Authorization, backend validation, CSP and header deployment, token architecture and API security remain yours.

## Everything the browser receives is public

- **`axiom-config.js` / `window.AXIOM_CONFIG`** is public by construction: anyone who loads the page can read it. It is not a place for secrets.
- **`GRAPHQL_API_KEY`** is sent as `x-api-key` only when there is no user token (`src/core/gateway.js`). It identifies the client for unauthenticated access — the AppSync API-key model — and grants exactly what the API grants anonymous callers. Protect the API with authentication, rate limits and an origin allow-list; never with this value.

## The threat that matters: script running in the page

Every other control is secondary to cross-site scripting. Script executing in the page can call `auth.getAccessToken()`, import the auth singleton, and act as the user — whatever the token storage. Axiom's defences:

1. **Content-Security-Policy.** The deploy injects a `<meta>` policy (`tools/csp.js`):
   - `script-src 'self'` plus the import map's sha256 — no `'unsafe-inline'`, no `'unsafe-eval'` — so injected `<script>` elements, inline event handlers and `eval` do not run.
   - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.
   - `connect-src 'self'` plus the origins in the runtime config, so a fetch to any other origin is refused.

   Rewriting the import map changes its hash, so the deploy computes the policy from the final HTML and `--check`s it (exit 1 if missing or stale). For dist deploys: `node tools/csp.js dist/index.html --write --config axiom-config.js` after `npm run build`.
2. **No HTML sinks for untrusted data.** `notify()` renders text (`textContent`); templates escape interpolated data (`BaseComponent._esc`). CI enforces two invariants in `tools/csp.test.js`: no inline `on*=` handlers and no `eval` / `new Function` anywhere in `src/`.
3. **Limits, stated plainly.**
   - `style-src` still allows `'unsafe-inline'`: shadow templates use `style` attributes and two `<style>` blocks. That admits CSS injection, not script execution.
   - A `<meta>` policy cannot set `frame-ancestors` or reporting. `_headers` sends `X-Frame-Options: DENY` on hosts that honour it (Cloudflare Pages / Workers). **GitHub Pages sends no custom headers, so the showcase has no framing protection.** Where the host allows headers, send this policy as a real `Content-Security-Policy` header and add `frame-ancestors 'none'`.

## Tokens

- **`auth.js` is a placeholder integration** — a working example of wiring an identity provider into Axiom (Google through the Nexus worker, or Cognito), not a security architecture. Replace it with whatever your application uses. Everything below describes the example as shipped.
- Login is authorization code + PKCE with a per-login `state`. The flow's one-shot keys (verifier, state, provider) stay in localStorage, because some in-app browsers finish the redirect in a fresh tab where sessionStorage is empty.
- Persisted identity — the token bundle, profile and avatar cache — lives in the store the app chooses: `auth.init({ tokenStore: 'local' | 'session' | 'memory' | adapter })`. The default is `'local'`. Choosing a shorter-lived store deletes any copy an earlier session left in localStorage.
- **What the choice buys is persistence, not immunity.** A refresh token in localStorage can be lifted by one XSS and used from elsewhere until it expires or is revoked. In `'session'` it dies with the tab, in `'memory'` with the page. None of them stops script that is already running in the page.
- **The real fix is not holding the refresh token in the browser.** A backend-for-frontend keeps it server-side behind an `HttpOnly; Secure; SameSite` cookie. The Direct-Google worker already brokers code exchange and refresh, so it is the natural place for this; that is a worker change outside this repository, and it is the recommended step for anything handling money, orders or accounts.
- One refresh is in flight per page (single-flight). An explicit rejection (401 / `invalid_grant`) clears the session; a transient failure keeps it and retries.
- At the identity provider: enable refresh-token rotation with reuse detection, and keep absolute lifetimes short.

## Optimistic writes

`state.mutate()` is safe for concurrent writes to one key: a pending ledger ensures a failure removes only its own change. It is optimistic UI, not a transaction — the server stays the authority. Reconcile from it; a `query()` refetch rebases any writes still in flight.

## Reporting a vulnerability

Report suspected vulnerabilities privately to the repository owner ([github.com/cybercussion](https://github.com/cybercussion)), not in a public issue or pull request.
