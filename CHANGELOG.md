# Changelog — Axiom core

What changed in the runtime the fleet copies: `src/core/`, `src/shared/base-component.js`, and the `tools/` that ship with them. Versioning policy: [docs/contracts.md](docs/contracts.md#versioning). Release numbering waits on the fleet's decision to version the core; until then, changes accumulate under **Unreleased**.

## Unreleased — the review response (2026-09-10 → 2026-09-11)

Every criticism in the external review, and what happened to it: [the ledger](docs/superpowers/specs/2026-09-11-review-response-design.md).

### Second review — defensibility (2026-09-11)

The second review's claims were tested before anything was built — [the validation](docs/superpowers/specs/2026-09-11-review-2-validation.md). What the tests found, and what shipped:

- **Fixed:** a navigation that lost left its data on the page that won — `/item/1` (slow) then `/item/2` showed item 1; a loader honouring its signal flashed an error instead. `state.query()` and `gateway` now take a `signal`; an aborted query writes nothing. (`00e8f70`)
- **Fixed:** a component that threw in `setup()`/`render()` left its navigation half-committed forever. Contained now: a bubbling, cancelable `axiom:component-error`, a fallback in the component's own shadow root, and `rendered` always resolves. (`188a660`)
- **Fixed:** `state.set('__proto__', …)` replaced the store's prototype. The store has none now. (`00e8f70`)
- **Fixed:** the logger read messages as format directives (CodeQL). (`a791a69`)
- **Added:** `state.query(…, { signal })`, gateway `{ signal }`, `axiom:component-error`. (`00e8f70`, `188a660`)
- **Tests:** a seeded property test for concurrent mutations (50,000 sequences checked); invariant tests for the navigation race and component containment; the full browser suite on Chromium, WebKit and Firefox in CI. (`dc5b7e0`, `6bf5ba0`)
- **Docs:** a contract per primitive (`docs/contracts.md`); a threat model and "Axiom does not make your application secure" (`SECURITY.md`); "When NOT to use Axiom" (README); auth documented as a placeholder.
- **Repository:** Dependabot alerts and security updates, and CodeQL default setup, are on.
- **Added:** route changes are announced to screen readers (`@core/announce.js`, reconciled from the fleet's never-imported announce-bus); a template `/login` (reconciled from tender) that says so when no provider is configured — the dock's Login link no longer lands on the 404; `rel="external"` opts a same-origin link out of client routing (reconciled from ev).
- **Fixed:** `/components` reflowed its whole layout on load — CLS 1.09 measured on the live site. Two races: shadow roots rendered before the fetched theme arrived, and the nav orchestrator measured the dock before it had drawn, read it as a sidebar and padded the content 1280 px. The shared theme is now read from the page's own `<link>` (no second request; full before any component connects), and the orchestrator measures after `rendered`. (`1314916`)
- **Fixed:** WebKit on Linux CI went 6 s without starting a view transition, holding a navigation whose address had already changed. The router now waits at most 1 s, then skips the transition and commits. (`1314916`)
- **Added:** a budget for the runtime core — `tools/weigh.js --check` fails past 13 KB Brotli (12.2 KB today), and the README states it; a layout-shift ceiling and layout invariants in the browser suite; `npm run bench`, reported and never gated. (`1314916`)
- **Tests:** the browser suite counts the logger's errors (it prints every level through `console.log`). Each new invariant fails against the code before its fix. (`1314916`)

### Breaking — for projects that copy the core

- **`BaseComponent` renders only after the theme.** A page that links `theme.css` in its `<head>` sees no change. A page that doesn't now waits for the fetched theme before `render()`, so code after `super.connectedCallback()` that touches the shadow DOM belongs in `onRendered()`. A component that owns its shadow root outright should override `render()` — the default draws a `<slot>`. (`1314916`)

- **`core/state.js` declares no application keys.** `audioLevel`, `captionsEnabled`, `autoplayEnabled`, `sessionId` and `items` are gone from core. Declare yours with `state.define()` in your own module and import it from whatever reads those keys — `src/app-state.js` is the pattern, and it keeps the historical storage keys so saved settings survive. (`124b2c2`)
- **`auth.logout()` no longer clears `sessionId`.** Clear application session state when `user` becomes `null`. (`124b2c2`)
- **`state.redirectAfterAuth` is removed.** It never worked: it persisted to sessionStorage while the router reads localStorage. (`124b2c2`)

### Changed

- Gateway failures are `GatewayError`s — still `Error`s, with the same message for non-2xx responses. (`b9413f1`)
- Terminal navigation failures no longer overwrite `document.body`; they emit `axiom:router-error`. (`a6390fe`)
- `npm start` runs `tools/serve.js` instead of fetching `serve` through npx. (`f9dfce7`)

### Added

- `state.update(key, fn)` (`76b25b0`) and `state.define(key, options)` (`124b2c2`).
- Gateway `expect` — `'auto'` (default, unchanged) | `'json'` | `'xml'` | `'text'` | `'blob'` | `'response'` — and `GatewayError` carrying `status`, `contentType`, `url`, `body`. (`b9413f1`)
- `auth.init({ tokenStore })` — `'local'` (default) | `'session'` | `'memory'` | adapter. (`76f0a99`)
- `axiom:router-error`: cancelable, `{ reason, error, slug, path }`. (`a6390fe`)
- `--ax-slider-height` and `--ax-slider-icon-size` for `ax-slider variant="fill"`. (`227a7c1`)
- `types/` — declarations generated from the source; `tests/types/contract.ts` pins misuse. (`0351282`)
- Tools: `csp.js` (`354098c`), `serve.js` (`f9dfce7`), `types.js` (`0351282`). `axiom-config.js`, the public runtime config (`354098c`). `SECURITY.md` (`adb0cc5`). `docs/contracts.md`.
- Tests: a node suite for the core (`006c996` onward) and a browser suite under the production CSP (`abb935a`).

### Fixed

- `mutate()` destroyed a primitive backup on rollback and threw on a null one, inside its own catch. (`b9fa5a6`)
- `mutate()` with writes in flight on one key: a failure could discard a different write the server had accepted. (`5e0b135`)
- `notify()` rendered its message as HTML. (`6564943`)
- Router: every nav click navigated twice and pushed two history entries; `target`, download and modifier clicks were intercepted. (`dec76fb`)
- Router: a navigation superseded mid-commit still scrolled, focused and saved — a fast Back lost its scroll position. (`b56bbb7`)
- Router: a skipped view transition raised an unhandled rejection. (`bd68e2f`)
- Router: the 404 recovery rewrote the URL out of the deployment's base path. (`a6390fe`)
- Router: a new page landed where an earlier visit had been scrolled, and focus scrolled the viewport. (`f970f5e`)
- CI: the lockfile was ignored while the deploy gated on `npm ci`, so no gate had ever run. (`bd43e52`)

### Docs

- README numbers re-measured and enforced: line counts within 10% (was 15%), shipped bytes checked against the real build by `tools/weigh.js` on every deploy. The first "~57 KB gzipped" was measured as one concatenated archive; compressed per file, as browsers fetch modules, the app is ~87 KB gzip / ~73 KB Brotli.

### Security

- Deploy-time Content-Security-Policy: `script-src 'self'` plus the import map's hash — no `'unsafe-inline'`, no `eval`. (`354098c`)
- No inline event handlers anywhere in `src/`, enforced in CI. (`6564943`, `354098c`)
