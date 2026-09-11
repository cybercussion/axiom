# Changelog — Axiom core

What changed in the runtime the fleet copies: `src/core/`, `src/shared/base-component.js`, and the `tools/` that ship with them. Versioning policy: [docs/contracts.md](docs/contracts.md#versioning). Release numbering waits on the fleet's decision to version the core; until then, changes accumulate under **Unreleased**.

## Unreleased — the review response (2026-09-10 → 2026-09-11)

Every criticism in the external review, and what happened to it: [the ledger](docs/superpowers/specs/2026-09-11-review-response-design.md).

### Breaking — for projects that copy the core

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

### Security

- Deploy-time Content-Security-Policy: `script-src 'self'` plus the import map's hash — no `'unsafe-inline'`, no `eval`. (`354098c`)
- No inline event handlers anywhere in `src/`, enforced in CI. (`6564943`, `354098c`)
