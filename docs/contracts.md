# Axiom contracts

The rules the runtime keeps, stated so they can be relied on — and so a change that breaks one is visibly a breaking change. `types/` is the machine-readable half (generated from the source, drift-checked by `npm test`, with misuse pinned in `tests/types/contract.ts`). This page is the half types can't express. Where a guarantee is exercised by a test, the test is named.

## What Axiom is

A client-side application runtime. Several projects on this machine run copies of `src/core/`, so it is a framework in fact. It is not server-rendered and will not become so: there is no SSR story because there is no server half.

Each primitive below lists the same eight things: **inputs · outputs · lifecycle · failure · cancellation · ordering · extension points · not supported.**

## Router — `src/core/router.js`

| | |
|---|---|
| **Inputs** | `router.init({ routes, depths, order, defaultRoute, basePath, appName, loginPath })`; `router.navigate(path, push?, direction?)`; clicks on internal links |
| **Outputs** | `state.route`, `state.params`, `state.query`, `state.navigation` (`{ phase, navigationId, path, cleanPath, slug, params, direction, timestamp }`); `document.title`; the page element in `#app-container`; `onNavigation()` / `onMatch()` callbacks; `axiom:router-error` |
| **Lifecycle** | start → guard → the route's module and its data, in parallel → route committed (`state.route` set, page element created) → the page's `rendered` awaited → commit published → focus and scroll, on the next two frames |
| **Failure** | An unknown route or a failing module renders the 404 page. If the 404 fails too, a cancelable `axiom:router-error` fires on `window` (`{ reason, error, slug, path }`); unhandled, a notice is drawn in `#app-container`, never over `document.body`. A failing data load does **not** block the route: it commits with its `dataKey` in `status: 'error'`. A page component that throws is contained (see Component). A view transition the browser never starts holds nothing: after 1 s it is skipped, a warning is logged, and the navigation commits. |
| **Cancellation** | A newer navigation aborts the one in flight. Its `AbortController` fires — route loaders receive the `signal` as `api(params, signal)` — its data query writes nothing, and it never commits, moves focus, scrolls or saves a scroll position. |
| **Ordering** | Only the last navigation started may commit. Each navigation publishes `start`; only the one that wins publishes `commit`. A click is handled once. |
| **Extension points** | `RouteConfig` — `path`, `title`, `guard`, `api` (a URL, or `(params, signal) => Promise`), `dataKey`; `appName` (the name in every page title — a route with no `title` shows it alone, which is what a home route usually wants) and `loginPath` (where a failed guard goes; default `/login`) on `init`; `onNavigation`, `onMatch`; `axiom:router-error`. A slug with no route loads `@features/<slug>/<slug>.js`. `rel="external"` on a same-origin link leaves it to the browser, as do `target`, `download`, modifier keys and non-primary buttons. |
| **Not supported** | Nested routes or layouts; hash routing; server rendering; a "leave this page?" guard; preload hints. The router carries nothing of the app's: page titles, the app name and the login path are all options. |
| **Tested by** | `tests/e2e/app.spec.js`: rapid navigation lands on the last route; one click is one navigation and one history entry; back/forward; a push lands at the top and Back restores the offset, ordinary and in flight; a navigation that lost leaves no data behind; both paths of `axiom:router-error`; a view transition that never starts does not hold the navigation |

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
| construct | An open shadow root is attached — `delegatesFocus` on, unless the class sets `static delegatesFocus = false`. The shared theme sheet is adopted — filled from the page's own `<link>` to `theme.css` when it has one (module scripts run after the head's stylesheets load, so it is already full), fetched when it does not. `rendered` is created. | — |
| connect | The host mirrors input modality (`data-modality`) and the theme (`data-theme`), and follows theme changes. Then, in order: | |
| | wait for the theme — only when it is still being fetched; nothing renders into an empty sheet | — |
| | `await this.setup()` — load styles, fetch, subscribe | `setup()` — optional, may be async |
| | `this.render()` — draw the shadow DOM | `render()` |
| | `await this.onRendered()` | `onRendered()` — optional |
| | `rendered` resolves. **The router awaits it** before moving focus and scroll. | — |
| fail | A throw in `setup()`, `render()` or `onRendered()` fires `axiom:component-error` — bubbling, composed (it crosses shadow roots), cancelable, `{ error, phase, component }`. Any ancestor is a boundary: `preventDefault()` and the fallback is yours. Unhandled, the component draws a notice (`role="alert"`) inside its own shadow root. `rendered` resolves either way. | listen on any ancestor |
| disconnect | Every `this.subscribe()` subscription and the theme follower are released. | call `super.disconnectedCallback()` if you override it |

Rules:
- Overriding `connectedCallback`? Do your async work, then call `super.connectedCallback()` (see `nav-dock`).
- Code after `super.connectedCallback()` can run before `render()`: on a page that makes BaseComponent fetch the theme, rendering waits for it. Touch the shadow DOM in `onRendered()`.
- Own the shadow root outright, as `nav-orchestrator` does? Override `render()` — the default draws a `<slot>` over whatever is there.
- Subscribe through `this.subscribe(key, fn)`; it is released for you. A direct `state.subscribe()` is yours to release.
- Put text in with `textContent`. When a template must interpolate data, pass it through `this._esc()`.
- No inline `on*=` handlers. CI fails them (`tools/csp.test.js`), and the production CSP blocks them.

Not supported: re-render diffing; server rendering or hydration; attribute-to-property reflection beyond what each control implements. Tested by the component-containment and theme tests in `tests/e2e/app.spec.js` — including a page with no theme `<link>` whose theme arrives late.

## Observability

The core narrates its own work as events on `window` (`@core/observe.js`). One name per kind, with a `phase`. **Every `start` ends exactly once, carrying the same id**, so a consumer pairs them without guessing.

| Event | Phases | Detail |
|---|---|---|
| `axiom:navigation` | `start` → `commit` \| `abort` \| `error` | `navigationId`, `path` (no query or hash), `slug`; on the end `ms`, plus `supersededBy` (abort) or `error` |
| `axiom:request` | `start` → `response` \| `error` \| `abort` | `id`, `method`, `url`; on the end `ms` and `status`, plus `error` for a failure. A cancellation is an `abort`, never an `error` |
| `axiom:mutation` | `start` → `success` \| `rollback` | `id`, `key`; on the end `ms`, plus `error` for a rollback. `success` means the server accepted the write; it lands once every earlier write to that key has settled |
| `axiom:auth` | `login` · `login-failed` · `refresh` · `refresh-failed` (`rejected`: the session is gone) · `logout` | the phase; `provider` on login |
| `axiom:router-error` | — | cancelable; see Router |
| `axiom:component-error` | — | cancelable, bubbles through shadow roots; see Component |

`observe(fn)` hands one function every name above and returns the unsubscribe. A handler that throws is logged, never thrown back into the runtime. Or listen to just the names you want with `addEventListener`.

A detail never carries headers, bodies, payloads or tokens. A request's `url` is the one fetched, query string included: scrub it before it leaves the page.

Also watchable: every state change (`state.subscribe(fn)`), each navigation as state (`router.onNavigation(fn)`), a blocked script or connection (the browser's own `securitypolicyviolation`).

Tested by `tests/core/observe.test.js` — requests, GraphQL, mutations, auth, `observe()` — and `tests/e2e/app.spec.js`: in a burst of navigations only the last commits, every start ends once, and an unknown route ends in `error`.

## Performance budgets

Enforced where the measurement is deterministic; reported where it is not.

| Budget | Limit | Enforced by |
|---|---|---|
| The runtime core as shipped — `src/core/` + `BaseComponent`, minified, Brotli per file | 14 KB (13.0 KB today; raised from 13 KB when the core began narrating itself — the events cost 0.8 KB) | `node tools/weigh.js --check`, on every deploy |
| Layout shift loading `/components` and `/dashboard` | CLS < 0.1, web.dev's "good" | the browser suite, in Chromium — the only engine that reports layout shift |
| Nothing paints before the theme; a late theme or a late dock stylesheet moves nothing | invariant | the browser suite, all three engines |
| A view transition the browser does not start | skipped after 1 s | the browser suite, all three engines |
| `state` set, fan-out, update, mutate, query | reported, not gated — timings move with the machine | `npm run bench` |

Why the layout budget exists: `/components` measured CLS 1.09 on the live site, 19 s after a deploy. Two races, both fixed. Shadow roots rendered before the fetched theme arrived (0.19 with the fetch held 900 ms) — the theme is now read from the page's own `<link>`. And the nav orchestrator measured the dock before the dock had drawn: it read an unstyled dock as a sidebar and padded the content 1280 px, collapsing the page to one column (up to 1.2 at 4× CPU) — it now measures after `rendered`. A clean load on a fast machine shows neither, so the CLS ceiling alone would not have caught them: the invariant tests hold a stylesheet to make each race certain, and each fails against the code before the fix.

## Accessibility

- **Route change:** focus moves to the new page's host (`tabIndex = -1`, `preventScroll`) once the page reports `rendered`.
- **Focus rings: one mechanism.** BaseComponent mirrors input modality as `data-modality` on every host; `theme.css` suppresses `:focus-visible` rings for pointer input only. Don't add per-component ring logic.
- **Shadow-DOM Tab order on Safari:** `@core/focus-walker.js` walks the composed tree.
- **Controls** put ARIA on the focusable element, not on the host — see [CONTROLS.md](CONTROLS.md).
- **Route changes are announced.** After the first load, every navigation that commits announces the new page's title through a polite live region (`@core/announce.js`, which reuses `#a11y-announcer`). A navigation that lost announces nothing.

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
