# Fleet re-borrow plans — 2026-09-11

Specula #13: a reconcile row leaves `open` only with a plan — what will change in that project, how it is verified, which `file/` claim is held. These are those plans for the operator's rows (#12, step 4). **None is executed.** Each waits on #12 steps 2 and 3 — specula's re-run and `fleet` answering the panels — and on the operator saying who works it. Order, as the operator gave it: tender → new.cybercussion.com → scobot → daystra → ev → SCOBotPackager.

The reference is axiom `65f0553`; its hashes and what a consumer provides are in [fleet-core-divergence.md](fleet-core-divergence.md) → "The reference". Measured from the bytes on marks-mbp by a read-only scan; no other tree was touched.

## Every row, the same steps

1. Claim `file/src/core/router.js` and `file/src/core/state.js` on the project's own channel.
2. Copy byte-for-byte from axiom: `src/core/{router,state,gateway,logger,observe,announce,focus-walker}.js` and `src/shared/base-component.js`. Where a project's gateway is genuinely its own, keep it and take `expect`, `GatewayError`, `{ signal }` and the `axiom:request` events instead.
3. Move the app keys out of core `state.js` into `src/app-state.js` with `state.define()`, keeping their storage keys so saved settings survive; import it first in `app.js`. React to `user → null` there rather than in `auth.logout()`.
4. Move the router's titles into each route's `title`, and pass `appName` (and `loginPath` if it isn't `/login`) to `router.init()`.
5. The app-level shell carries the same bugs axiom had — take its `nav-orchestrator.js` and `toast-manager.js` where flagged below.
6. Verify, release the claims, and post `reconcile <file> <project>: adopted — <why> — verify: <cmd>` on #specula.

## tender.cybercussion.com

| core file | lines differing from the reference |
|---|---|
| `src/core/router.js` | 347 |
| `src/core/state.js` | 303 |
| `src/core/gateway.js` | 192 |
| `src/core/logger.js` | 6 |
| `src/core/observe.js` | missing |
| `src/core/announce.js` | missing |
| `src/core/focus-walker.js` | identical |
| `src/shared/base-component.js` | 160 |

- **App keys to move** into `src/app-state.js`: `sessionId`, `items`. Axiom's `app-state.js` already declares `sessionId` under the same storage keys; add `items`.
- **Route titles to move** into route configs: 20 (plus `appName`).
- **Verify:** `npm test` (vitest run --config vitest.config.gateway.js && vitest run --config vi…).
- **Claims:** `file/src/core/router.js`, `file/src/core/state.js` on `#tender.cybercussion.com`.
- `nav-orchestrator.js` measures the dock before it draws — the /components CLS race. Take axiom's (measure after `rendered`; own `render()`).
- `toast-manager.js` renders `notify()` messages as HTML — an injection sink. Take axiom's (text).
- App modules living in `src/core/` stay the app's: `api.js`. Check each against the reference API it imports.

## new.cybercussion.com

| core file | lines differing from the reference |
|---|---|
| `src/core/router.js` | 330 |
| `src/core/state.js` | 309 |
| `src/core/gateway.js` | 192 |
| `src/core/logger.js` | 6 |
| `src/core/observe.js` | missing |
| `src/core/announce.js` | missing |
| `src/core/focus-walker.js` | identical |
| `src/shared/base-component.js` | 160 |

- **App keys to move** into `src/app-state.js`: `audioLevel`, `captionsEnabled`, `autoplayEnabled`, `sessionId`, `items`. Axiom's `app-state.js` already declares `audioLevel`, `captionsEnabled`, `autoplayEnabled`, `sessionId` under the same storage keys; add `items`.
- **Route titles to move** into route configs: 0.
- **Verify:** no test script — a browser smoke (boot, every route, no console error, no CSP violation) is the minimum.
- **Claims:** `file/src/core/router.js`, `file/src/core/state.js` on `#new.cybercussion.com`.
- `nav-orchestrator.js` measures the dock before it draws — the /components CLS race. Take axiom's (measure after `rendered`; own `render()`).
- `toast-manager.js` renders `notify()` messages as HTML — an injection sink. Take axiom's (text).

## scobot.cybercussion.com

| core file | lines differing from the reference |
|---|---|
| `src/core/router.js` | 343 |
| `src/core/state.js` | 315 |
| `src/core/gateway.js` | 192 |
| `src/core/logger.js` | 6 |
| `src/core/observe.js` | missing |
| `src/core/announce.js` | missing |
| `src/core/focus-walker.js` | identical |
| `src/shared/base-component.js` | 160 |

- **App keys to move** into `src/app-state.js`: `audioLevel`, `captionsEnabled`, `autoplayEnabled`, `language`, `sessionId`, `items`. Axiom's `app-state.js` already declares `audioLevel`, `captionsEnabled`, `autoplayEnabled`, `sessionId` under the same storage keys; add `language`, `items`.
- **Route titles to move** into route configs: 17 (plus `appName`).
- **Verify:** `npm test` (vitest run --config vitest.config.gateway.js && vitest run --config vi…).
- **Claims:** `file/src/core/router.js`, `file/src/core/state.js` on `#scobot.cybercussion.com`.
- `nav-orchestrator.js` measures the dock before it draws — the /components CLS race. Take axiom's (measure after `rendered`; own `render()`).
- App modules living in `src/core/` stay the app's: `auth.test.js`, `ingest-socket.js`, `session-socket.js`. Check each against the reference API it imports.

## daystra

| core file | lines differing from the reference |
|---|---|
| `src/core/router.js` | 318 |
| `src/core/state.js` | 321 |
| `src/core/gateway.js` | 192 |
| `src/core/logger.js` | 6 |
| `src/core/observe.js` | missing |
| `src/core/announce.js` | missing |
| `src/core/focus-walker.js` | 2 |
| `src/shared/base-component.js` | 172 |

- **App keys to move** into `src/app-state.js`: `audioLevel`, `captionsEnabled`, `autoplayEnabled`, `sessionId`, `guestId`, `activeStudentId`, `studentName`, `items`. Axiom's `app-state.js` already declares `audioLevel`, `captionsEnabled`, `autoplayEnabled`, `sessionId` under the same storage keys; add `guestId`, `activeStudentId`, `studentName`, `items`.
- **Route titles to move** into route configs: 12 (plus `appName`).
- **Verify:** no test script — a browser smoke (boot, every route, no console error, no CSP violation) is the minimum.
- **Claims:** `file/src/core/router.js`, `file/src/core/state.js` on `#daystra`.
- `nav-orchestrator.js` measures the dock before it draws — the /components CLS race. Take axiom's (measure after `rendered`; own `render()`).
- `toast-manager.js` renders `notify()` messages as HTML — an injection sink. Take axiom's (text).
- App modules living in `src/core/` stay the app's: `access.js`, `diag.js`, `librarian.js`, `nexus.js`, `registrar.js`, `socket.js`, `theme-orchestrator.js`, `voice-service.js`. Check each against the reference API it imports.

## energy/ev.cybercussion.com

| core file | lines differing from the reference |
|---|---|
| `src/core/router.js` | 314 |
| `src/core/state.js` | 305 |
| `src/core/gateway.js` | 192 |
| `src/core/logger.js` | 6 |
| `src/core/observe.js` | missing |
| `src/core/announce.js` | missing |
| `src/core/focus-walker.js` | identical |
| `src/shared/base-component.js` | 160 |

- **App keys to move** into `src/app-state.js`: `audioLevel`, `captionsEnabled`, `autoplayEnabled`, `sessionId`, `items`. Axiom's `app-state.js` already declares `audioLevel`, `captionsEnabled`, `autoplayEnabled`, `sessionId` under the same storage keys; add `items`.
- **Route titles to move** into route configs: 5 (plus `appName`).
- **Verify:** `npm test` (node --test "test/**/*.test.js").
- **Claims:** `file/src/core/router.js`, `file/src/core/state.js` on `#ev.cybercussion.com`.
- `nav-orchestrator.js` measures the dock before it draws — the /components CLS race. Take axiom's (measure after `rendered`; own `render()`).

## SCOBotPackager

| core file | lines differing from the reference |
|---|---|
| `src/core/router.js` | 323 |
| `src/core/state.js` | 309 |
| `src/core/gateway.js` | missing |
| `src/core/logger.js` | 6 |
| `src/core/observe.js` | missing |
| `src/core/announce.js` | missing |
| `src/core/focus-walker.js` | missing |
| `src/shared/base-component.js` | 160 |

- **App keys to move** into `src/app-state.js`: `audioLevel`, `captionsEnabled`, `autoplayEnabled`, `sessionId`, `items`. Axiom's `app-state.js` already declares `audioLevel`, `captionsEnabled`, `autoplayEnabled`, `sessionId` under the same storage keys; add `items`.
- **Route titles to move** into route configs: 9 (plus `appName`).
- **Verify:** `npm test` (node --test packages/packager-core/test/*.test.js packages/lesson-view…).
- **Claims:** `file/src/core/router.js`, `file/src/core/state.js` on `#SCOBotPackager`.
- **No `<link>` to theme.css in `<head>`.** The reference BaseComponent then fetches the theme and every component waits for it; add the link, or accept the wait. A component that owns its shadow root must override `render()`.
- `auth.js` lacks `isAuthenticated()`, `getAccessToken()`, which the reference router/gateway call.

