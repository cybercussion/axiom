# Axiom contracts

The rules the runtime keeps, stated so they can be relied on — and so a change that breaks one is visibly a breaking change. `types/` is the machine-readable half (generated from the source, drift-checked by `npm test`, with misuse pinned in `tests/types/contract.ts`). This page is the half types can't express. Where a guarantee is exercised by a test, the test is named.

## What Axiom is

A client-side application runtime. Several projects on this machine run copies of `src/core/`, so it is a framework in fact. It is not server-rendered and will not become so: there is no SSR story because there is no server half.

Each primitive below lists the same eight things: **inputs · outputs · lifecycle · failure · cancellation · ordering · extension points · not supported.**

## Router — `src/core/router.js`

| | |
|---|---|
| **Inputs** | `router.init({ routes, depths, order, defaultRoute, basePath })`; `router.navigate(path, push?, direction?)`; clicks on internal links |
| **Outputs** | `state.route`, `state.params`, `state.query`, `state.navigation` (`{ phase, navigationId, path, cleanPath, slug, params, direction, timestamp }`); `document.title`; the page element in `#app-container`; `onNavigation()` / `onMatch()` callbacks; `axiom:router-error` |
| **Lifecycle** | start → guard → the route's module and its data, in parallel → route committed (`state.route` set, page element created) → the page's `rendered` awaited → commit published → focus and scroll, on the next two frames |
| **Failure** | An unknown route or a failing module renders the 404 page. If the 404 fails too, a cancelable `axiom:router-error` fires on `window` (`{ reason, error, slug, path }`); unhandled, a notice is drawn in `#app-container`, never over `document.body`. A failing data load does **not** block the route: it commits with its `dataKey` in `status: 'error'`. A page component that throws is contained (see Component). |
| **Cancellation** | A newer navigation aborts the one in flight. Its `AbortController` fires — route loaders receive the `signal` as `api(params, signal)` — its data query writes nothing, and it never commits, moves focus, scrolls or saves a scroll position. |
| **Ordering** | Only the last navigation started may commit. Each navigation publishes `start`; only the one that wins publishes `commit`. A click is handled once. |
| **Extension points** | `RouteConfig` — `path`, `guard`, `api` (a URL, or `(params, signal) => Promise`), `dataKey`; `onNavigation`, `onMatch`; `axiom:router-error`. A slug with no route loads `@features/<slug>/<slug>.js`. |
| **Not supported** | Nested routes or layouts; hash routing; server rendering; a "leave this page?" guard; preload hints. The router still carries this app's page titles (`ROUTE_TITLES`) and sends a failed guard to `/login` — tracked coupling. |
| **Tested by** | `tests/e2e/app.spec.js`: rapid navigation lands on the last route; one click is one navigation and one history entry; back/forward; a push lands at the top and Back restores the offset, ordinary and in flight; a navigation that lost leaves no data behind; both paths of `axiom:router-error` |

**The race the second review asked about.** *Navigation A is loading, B starts, A's component resolves, B's API fails, A's API then resolves.* A was aborted the moment B started, so its late component is ignored and its late API response writes nothing. B commits, rendering with `state[dataKey].status === 'error'`. The page never shows A's data — whether A's loader honours its `AbortSignal` or ignores it.

## State — `src/core/state.js`

| | |
|---|---|
| **Inputs** | `set`, `update`, `define`, `query`, `mutate`, `notify`; assigning `state.data.key` |
| **Outputs** | `get`, `select`, `subscribe(({ key, value }) => …)` |
| **Lifecycle** | A key exists once declared with `define()` or first set. A persisted key reads its storage at `define()`; declaring a default never writes it. |
| **Failure** | `query`: `status: 'error'`, previous data kept, the error rethrown. `mutate`: only its own change is removed, and a toast says so. Storage that throws (private mode, quota, a sandboxed frame) degrades to memory. |
| **Cancellation** | `query(key, fetcher, ttl, { signal })`: an aborted query writes no result — not its data, not an error — restores the value from before it if nothing else wrote the key, and rejects with an `AbortError`. `mutate` is not cancellable; it settles with its remote task. |
| **Ordering** | Subscribers run synchronously, in subscription order, once per changed top-level key. Setting a key to the identical value notifies nobody. Concurrent mutations on one key fold in issue order: the result is the initial value plus every successful change, in the order they were issued. |
| **Extension points** | `define()` for application keys, with any `{ getItem, setItem, removeItem }` storage. |
| **Not supported** | Nested reactivity — use `update()`. Transactions across keys. Derived subscriptions beyond `select()`. Undo history. |
| **Tested by** | `tests/core/state*.test.js`, `tests/core/cancellation.test.js`; `tests/core/state-fuzz.test.js` holds the fold rule for 2,000 random sequences per run (50,000 checked) |

## Gateway — `src/core/gateway.js`

| | |
|---|---|
| **Inputs** | `request(method, endpoint, body?, headers?, { expect, signal })`; `get`/`post`/`put`/`delete`; `graphql(operation, variables?, headers?, { signal })` |
| **Outputs** | The response body, read according to `expect`; or a `GatewayError` |
| **Lifecycle** | Attach the access token (`auth.getAccessToken()`, which may refresh first) → `fetch` → read the body |
| **Failure** | A non-2xx response, a response of a type other than an explicit `expect`, malformed JSON under `expect: 'json'`, and a GraphQL `errors[]` all reject with a `GatewayError` carrying `status`, `contentType`, `url`, `method` and the first 2 KB of the body. `expect: 'auto'` (the default) reads by content type and does not assert. |
| **Cancellation** | `signal` reaches `fetch`. An aborted request rejects with the `AbortError` itself — never a `GatewayError`, never data — and is not logged as a failure. |
| **Ordering** | None across requests. Concurrent requests share one token refresh. |
| **Extension points** | Headers, `expect`, `signal`. |
| **Not supported** | Retries and backoff; request deduplication or caching (use `state.query`); interceptors or middleware; upload progress. |
| **Tested by** | `tests/core/gateway.test.js`, `tests/core/cancellation.test.js` |

## Auth — `src/core/auth.js`, a placeholder

`auth.js` is a working **example** of wiring an identity provider into Axiom — Google through the Nexus worker, or Cognito. It is not a security architecture. Replace it with whatever your application actually uses; the table describes the example as shipped.

| | |
|---|---|
| **Inputs** | `init({ keepAlive, tokenStore })`, `loginWith(provider)`, `logout()` |
| **Outputs** | `state.user`; `isAuthenticated()`, `getAccessToken()`, `getIdToken()`, `getUser()` |
| **Lifecycle** | `init()` finishes an OAuth callback or restores a stored session. A keep-alive refresh fires at the leading edge of a 10-minute window. |
| **Failure** | An explicit refresh rejection (401, `invalid_grant`) clears the session and sets `user` to `null`. A transient failure keeps the session and retries in 60 s. |
| **Cancellation** | None. |
| **Ordering** | Concurrent `getAccessToken()` callers share one refresh (single-flight). |
| **Extension points** | `tokenStore`: `'local'` (default), `'session'`, `'memory'`, or an adapter. |
| **Not supported** | A backend-for-frontend holding the refresh token server-side — the production pattern, owned by your backend (SECURITY.md); roles beyond the token's claims; refresh coordinated across tabs. |
| **Tested by** | `tests/core/auth-store.test.js`, `tools/auth-helpers.test.js` |

## Component — `BaseComponent`

| Phase | What happens | Your hook |
|---|---|---|
| construct | An open shadow root is attached — `delegatesFocus` on, unless the class sets `static delegatesFocus = false`. The shared theme sheet is adopted. `rendered` is created. | — |
| connect | The host mirrors input modality (`data-modality`) and the theme (`data-theme`), and follows theme changes. Then, in order: | |
| | `await this.setup()` — load styles, fetch, subscribe | `setup()` — optional, may be async |
| | `this.render()` — draw the shadow DOM | `render()` |
| | `await this.onRendered()` | `onRendered()` — optional |
| | `rendered` resolves. **The router awaits it** before moving focus and scroll. | — |
| fail | A throw in `setup()`, `render()` or `onRendered()` fires `axiom:component-error` — bubbling, composed (it crosses shadow roots), cancelable, `{ error, phase, component }`. Any ancestor is a boundary: `preventDefault()` and the fallback is yours. Unhandled, the component draws a notice (`role="alert"`) inside its own shadow root. `rendered` resolves either way. | listen on any ancestor |
| disconnect | Every `this.subscribe()` subscription and the theme follower are released. | call `super.disconnectedCallback()` if you override it |

Rules:
- Overriding `connectedCallback`? Do your async work, then call `super.connectedCallback()` (see `nav-dock`).
- Subscribe through `this.subscribe(key, fn)`; it is released for you. A direct `state.subscribe()` is yours to release.
- Put text in with `textContent`. When a template must interpolate data, pass it through `this._esc()`.
- No inline `on*=` handlers. CI fails them (`tools/csp.test.js`), and the production CSP blocks them.

Not supported: re-render diffing; server rendering or hydration; attribute-to-property reflection beyond what each control implements. Tested by the component-containment tests in `tests/e2e/app.spec.js`.

## Observability

What can be watched today, and how:

| Signal | How |
|---|---|
| Every state change | `state.subscribe(fn)` |
| Each navigation's start and commit | `router.onNavigation(fn)` |
| A terminal navigation failure | `axiom:router-error` on `window` (cancelable) |
| A component failure | `axiom:component-error` — bubbles through shadow roots to `window` (cancelable) |
| A blocked script or connection | the browser's own `securitypolicyviolation` event |

## Accessibility

- **Route change:** focus moves to the new page's host (`tabIndex = -1`, `preventScroll`) once the page reports `rendered`.
- **Focus rings: one mechanism.** BaseComponent mirrors input modality as `data-modality` on every host; `theme.css` suppresses `:focus-visible` rings for pointer input only. Don't add per-component ring logic.
- **Shadow-DOM Tab order on Safari:** `@core/focus-walker.js` walks the composed tree.
- **Controls** put ARIA on the focusable element, not on the host — see [CONTROLS.md](CONTROLS.md).
- **Gap:** `#a11y-announcer` (`aria-live="polite"`) is declared in `index.html`, but nothing writes to it. Route changes are not announced to screen readers beyond the focus move.

## Browser support

| Feature | Chrome / Edge | Safari | Firefox | Used for |
|---|---|---|---|---|
| Import maps | 89 | 16.4 | 108 | bare module specifiers |
| `adoptedStyleSheets` | 73 | 16.4 | 101 | one theme sheet, every shadow root |
| `ElementInternals` | 77 | 16.4 | 93 | form-associated controls |
| `color-mix()` | 111 | 16.2 | 113 | theme colors |

**Floor: Chrome / Edge 111, Safari 16.4, Firefox 113.** Progressive, never required: View Transitions (an instant swap without them) and CSS `linear()` easing (Chrome 113, Safari 17.2, Firefox 112; falls back to the default curve). Versions from MDN browser-compat-data, checked 2026-09-11.

**Tested on every deploy** in Chromium, WebKit and Firefox — the full browser suite, under the production CSP. Mobile browsers are not yet in the matrix.

## Versioning

The core contract is `types/` plus this page. The policy: removing or narrowing anything in either is a **major** change, an addition is **minor**, a fix is **patch**, and every change is recorded in [CHANGELOG.md](../CHANGELOG.md) — breaking ones called out for the projects that copy the core. Release numbering waits on the fleet's decision to make the core a versioned unit (specula `accept`); until then changes accumulate under *Unreleased*. `package.json`'s version (1.0.42) versions the showcase site, not the core.
