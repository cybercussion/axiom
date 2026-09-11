# Axiom contracts

The rules the runtime keeps, stated so they can be relied on — and so a change that breaks one is visibly a breaking change. `types/` is the machine-readable half (generated from the source, drift-checked by `npm test`, with misuse pinned in `tests/types/contract.ts`). This page is the half types can't express.

## What Axiom is

A client-side application runtime. Eight projects on this machine run copies of `src/core/`, so it is a framework in fact. It is not server-rendered and will not become so: there is no SSR story because there is no server half.

## Component lifecycle — `BaseComponent`

| Phase | What happens | Your hook |
|---|---|---|
| construct | An open shadow root is attached — `delegatesFocus` on, unless the class sets `static delegatesFocus = false` (eight do, where delegation would scroll-jump). The shared theme sheet is adopted. `rendered` is created. | — |
| connect | The host mirrors input modality (`data-modality`) and the theme (`data-theme`), and follows theme changes. Then, in order: | |
| | `await this.setup()` — load styles, fetch, subscribe | `setup()` — optional, may be async |
| | `this.render()` — draw the shadow DOM | `render()` |
| | `await this.onRendered()` | `onRendered()` — optional |
| | `rendered` resolves. **The router awaits it** before moving focus and scroll, so a page is complete when the user lands on it. | — |
| disconnect | Every `this.subscribe()` subscription and the theme follower are released. | Call `super.disconnectedCallback()` if you override it. |

Rules:
- Overriding `connectedCallback`? Do your async work, then call `super.connectedCallback()` (see `nav-dock`).
- Subscribe through `this.subscribe(key, fn)`; it is released for you. A direct `state.subscribe()` is yours to release.
- Put text in with `textContent`. When a template must interpolate data, pass it through `this._esc()`.
- No inline `on*=` handlers. CI fails them (`tools/csp.test.js`) and the production CSP blocks them.

## State — `src/core/state.js`

- **Top-level keys are reactive; nested mutation is not.** Use `state.update(key, fn)`; it warns if the updater returns the same object.
- **`state.define()` is the one place a key's persistence is decided.** Core declares the framework's keys — `route`, `query`, `params`, `navigation`, `navStyle`, `transition`, `notifications`, `theme`. Applications declare theirs in their own module. Core never names an application key, and a test fails if it does.
- **`mutate()`** is optimistic and safe for concurrent writes to one key: a failure removes only its own change and never restores a value a later successful write replaced. It is not a transaction; the server stays the authority.
- **`query()`** caches per key for a TTL; a failed refetch keeps the previous data and rethrows.
- **`notify()`** renders its message as text.

## Router — `src/core/router.js`

- `routes: Record<string, RouteConfig>` — `path` (the feature module), `guard`, `api` (a URL, or `(params, signal) => Promise`), `dataKey`. A slug with no route loads `@features/<slug>/<slug>.js`.
- The module and its data load in parallel. The latest navigation wins (navigation ids + `AbortController`), and a navigation that loses stops completely: once a newer one starts it does not commit, move focus, scroll, or save a scroll position.
- A click is handled once. The router leaves alone a click another handler already `preventDefault`ed, and the ones the browser owns — a `target` other than `_self`, `download`, modifier keys, any button but the primary one.
- A new page lands at the top; back/forward restore the offset saved when the page was left; focus moves to the page host without scrolling.
- A terminal failure emits a cancelable `axiom:router-error` on `window` with `{ reason, error, slug, path }`. `preventDefault()` and the outcome is yours; unhandled, a minimal notice is drawn in `#app-container`, never over `document.body`.
- View Transitions are progressive: animated where supported, an instant swap elsewhere.
- **Known coupling, tracked in the review ledger:** the router still carries this app's page titles (`ROUTE_TITLES`) and a `/login` redirect for failed guards.

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

## Versioning

The core contract is `types/` plus this page. The policy: removing or narrowing anything in either is a **major** change, an addition is **minor**, a fix is **patch**, and every change is recorded in [CHANGELOG.md](../CHANGELOG.md) — breaking ones called out for the projects that copy the core. Release numbering waits on the fleet's decision to make the core a versioned unit (specula `accept`); until then changes accumulate under *Unreleased*. `package.json`'s version (1.0.42) versions the showcase site, not the core.
