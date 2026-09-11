# Fleet re-borrow runbook — 2026-09-11

Each project's **own seat** runs its own row. praxis's `guard-foreign-write.py` hard-blocks a seat from writing into another project's tree (operator decision 2026-09-05), so a foreign seat can measure and stage but never land — axiom's seat hit exactly that on tender. This file is written so a fresh agent inside the project can work its row without re-deriving anything.

Reference: axiom `3f55898` (github.com/cybercussion/axiom). Contracts: `axiom/docs/contracts.md`. Why it matters: `axiom/docs/fleet-core-divergence.md`.

## The reference — copy these, byte for byte

| file | sha256 (12) | lines |
|---|---|---|
| `src/core/router.js` | `d13dd2347965` | 643 |
| `src/core/state.js` | `270f7305bc28` | 362 |
| `src/core/gateway.js` | `226178011217` | 232 |
| `src/core/logger.js` | `daf9325dc814` | 32 |
| `src/core/observe.js` | `710eca332ff9` | 61 |
| `src/core/announce.js` | `304d8d28d124` | 77 |
| `src/core/focus-walker.js` | `012ae4963f9a` | 113 |
| `src/shared/base-component.js` | `6e09da395f30` | 273 |

`src/shared/styles/theme.css` (`97a0da3d7a12`, 715 lines) is **not** byte-adopted: the token set is the contract and each project's palette differs by design.

Never borrowed — these stay yours: `src/core/config.js`, `src/core/auth.js` (+ `auth-helpers.js`), anything else your project keeps under `src/core/`, and your features.

What the core expects you to provide: `config` with `API_BASE`, `BASE_PATH`, `ENV`, `GRAPHQL_API_KEY`, `GRAPHQL_ENDPOINT`, `NAV_STYLE`, `VERSION`; `auth` with `isAuthenticated()` and `getAccessToken()`; a `<link>` to your `theme.css` in `<head>` **before** the module scripts; and `tools/minify.js` if you ship a `dist/` (the router no longer stamps lazy-route paths itself).

## Before you touch anything

```sh
cd <project>
arc sync status --probe          # relay reachable? peers ahead?
arc sync pull                    # if a peer is ahead — never work a stale tree
node <axiom>/tools/fleet-smoke.js --root . --routes "/,<your public routes>"   # BASELINE, keep the output
npm run test:frontend            # or your suite — BASELINE
```
The baseline is the whole verification story: the re-borrow is correct when the after-run matches it. Claim the files on your own channel (`wire_claim file/src/core/router.js`, `file/src/core/state.js`, with a ttl), then:

```sh
arc intent declare "Re-borrow axiom's canonical runtime core (specula #12 step 4)" \
  --scope "src/core/**" --scope "src/shared/**" --scope "src/features/navigation/**" \
  --scope "src/app.js" --scope "src/app-routes.js" --scope "src/app-state.js" \
  --mode predicate --predicate "<your suite> passes and every public route mounts with no console error"
cd <the worktree it prints>
ln -s ../<project>/node_modules node_modules    # arc prunes node_modules; remove the symlink before completing
```

## The change

```sh
AX=/Users/markstatkus/cybercussion.com/axiom
for f in src/core/router.js src/core/state.js src/core/gateway.js src/core/logger.js \
         src/core/observe.js src/core/announce.js src/core/focus-walker.js src/shared/base-component.js; do
  cp "$AX/$f" "$f" && printf '%-44s %s\n' "$f" "$(shasum -a 256 "$f" | cut -c1-12)"
done            # zsh note: `for f in $VAR` does NOT word-split — list the files, as above
```
Then, in order:

1. **`src/app-state.js`** (new) — your keys, with their historical storage keys. Verbatim per project below. Import it as the **first** line of `src/app.js`: `import './app-state.js';`
2. **`src/app-routes.js`** — give each route the title your router used to hold, **after `path`** (a route test may require `path` first, and it reads better). Assert afterwards that every `@features/` path is unchanged: a careless regex here blanked 13 module paths on tender.
3. **`src/app.js`** — pass `appName` (and `loginPath` if it isn't `/login`) to `router.init()`.
4. **Shell fixes**, where flagged below: `src/features/navigation/nav-orchestrator.js` (measures the dock only after it has drawn — the race behind axiom's /components CLS 1.09) and `src/shared/toast-manager.js` (`notify()` renders text, closing an HTML injection sink).

Titles compose as `[route title] — [appName]`; a route with no title shows `appName` alone.

## Verify, then land

```sh
npm run test:frontend                                     # or your suite
node $AX/tools/fleet-smoke.js --root . --routes "/,..."   # compare against the baseline
rm node_modules                                           # the symlink
arc intent complete --outcome "..." --self-assessment "..."
arc intent merge <id>            # preview
arc intent merge <id> --execute  # land
```
Release your claims, then post the closure on #specula in #13's format:
`reconcile src/core/router.js <project>: adopted — <why> — verify: <cmd>`

Expected noise, not a regression: an unknown path logs a failed dynamic import before the router falls back to not-found. It appears in the baseline too.

## Pitfalls, each of which cost time on tender

- A title-insertion regex that read the wrong capture group blanked route module paths. The project's own route test and the smoke both caught it. Assert the paths survive.
- Arc prunes `node_modules` from the worktree; symlink it for the test run and remove it before completing.
- Run the smoke against the untouched tree **first**. Without the baseline you cannot tell your change from the app's pre-existing noise.

## Per project

### scobot.cybercussion.com — 21 routes, appName `SCOBot`
App keys: `audioLevel`, `captionsEnabled`, `autoplayEnabled`, `language`, `sessionId`, `items`. `items` is referenced nowhere outside `state.js` — drop it rather than declaring it.

```js
/**
 * Application state — the keys THIS app owns, declared where the app lives.
 * Storage keys are the historical ones: returning visitors keep their settings.
 */
import { state } from '@state';

const local = (() => { try { return globalThis.localStorage; } catch { return undefined; } })();
const session = (() => { try { return globalThis.sessionStorage; } catch { return undefined; } })();

state.define('audioLevel', { initial: 80, storage: local, storageKey: 'axiom-audioLevel',
  parse: (raw) => { const n = parseInt(raw, 10); return Number.isFinite(n) ? n : 80; } });
state.define('captionsEnabled', { initial: false, storage: local, storageKey: 'axiom-captionsEnabled', parse: (raw) => raw === 'true' });
state.define('autoplayEnabled', { initial: true, storage: local, storageKey: 'axiom-autoplayEnabled', parse: (raw) => raw !== 'false' });
state.define('sessionId', { initial: null, storage: local, storageKey: 'axiom-sessionId' });
state.define('language', { initial: '', storage: local, storageKey: 'axiom-language' });
```

Titles (17) to move onto routes: library Library · sessions Sessions · insights Insights · admin Admin · activity Activity · join Join · upload Upload · login Sign In · dashboard Dashboard · about About · contact Contact · privacy Privacy Policy · terms Terms of Service · profile Profile · licenses Licenses · not-found Not Found. `home` is the default route and its title was `SCOBot` — leave it off and let `appName` show alone.
Take the **nav-orchestrator** fix. `toast-manager` is already text-safe. Keeps its own: `ingest-socket.js`, `session-socket.js`, `auth.test.js` under `src/core/`. Theme `<link>` present. Verify with `npm run test:frontend` + smoke. Relay `cybercussion-arc-r2` — probe and pull first.

### daystra — 18 routes, appName `DΛYSTRΛ`
App keys: `audioLevel`, `captionsEnabled`, `autoplayEnabled`, `sessionId`, `guestId`, `activeStudentId`, `studentName`, `items`. `items` is referenced nowhere outside `state.js` — drop it rather than declaring it.

```js
/**
 * Application state — the keys THIS app owns, declared where the app lives.
 * Storage keys are the historical ones: returning visitors keep their settings.
 */
import { state } from '@state';

const local = (() => { try { return globalThis.localStorage; } catch { return undefined; } })();
const session = (() => { try { return globalThis.sessionStorage; } catch { return undefined; } })();

state.define('audioLevel', { initial: 80, storage: local, storageKey: 'axiom-audioLevel',
  parse: (raw) => { const n = parseInt(raw, 10); return Number.isFinite(n) ? n : 80; } });
state.define('captionsEnabled', { initial: false, storage: local, storageKey: 'axiom-captionsEnabled', parse: (raw) => raw === 'true' });
state.define('autoplayEnabled', { initial: true, storage: local, storageKey: 'axiom-autoplayEnabled', parse: (raw) => raw !== 'false' });
state.define('sessionId', { initial: null, storage: local, storageKey: 'axiom-sessionId' });
state.define('guestId', { initial: null, storage: session, storageKey: 'axiom-guestId' });
state.define('activeStudentId', { initial: null, storage: session, storageKey: 'axiom-activeStudentId' });
state.define('studentName', { initial: null, storage: session, storageKey: 'axiom-studentName' });
```

Titles (12): login Sign In · dashboard Dashboard · studio Studio · learn Learn · about About · contact Contact · privacy Privacy Policy · terms Terms of Service · profile Profile · catalog Catalog · not-found Not Found. `home` was `DΛYSTRΛ` — that is the appName; leave it off.
Take **both** shell fixes (its `notify()` still renders HTML). Keeps its own under `src/core/`: `access.js`, `diag.js`, `librarian.js`, `nexus.js`, `registrar.js`, `socket.js`, `theme-orchestrator.js`, `voice-service.js` — check each against the API it imports. **No frontend test script** (`test:ai` only), so the smoke is the verification: run it over every public route, baseline first.

### new.cybercussion.com — 18 routes, SEO titles, **pull from the MBA first**
Most work on this site happens on the MBA: `arc sync status --probe && arc sync pull` before anything, and do not start if a peer is ahead and unpullable.
App keys: `audioLevel`, `captionsEnabled`, `autoplayEnabled`, `sessionId`, `items`. `items` is referenced nowhere outside `state.js` — drop it rather than declaring it.

```js
/**
 * Application state — the keys THIS app owns, declared where the app lives.
 * Storage keys are the historical ones: returning visitors keep their settings.
 */
import { state } from '@state';

const local = (() => { try { return globalThis.localStorage; } catch { return undefined; } })();
const session = (() => { try { return globalThis.sessionStorage; } catch { return undefined; } })();

state.define('audioLevel', { initial: 80, storage: local, storageKey: 'axiom-audioLevel',
  parse: (raw) => { const n = parseInt(raw, 10); return Number.isFinite(n) ? n : 80; } });
state.define('captionsEnabled', { initial: false, storage: local, storageKey: 'axiom-captionsEnabled', parse: (raw) => raw === 'true' });
state.define('autoplayEnabled', { initial: true, storage: local, storageKey: 'axiom-autoplayEnabled', parse: (raw) => raw !== 'false' });
state.define('sessionId', { initial: null, storage: local, storageKey: 'axiom-sessionId' });
```

**Titles differ here.** There is no `ROUTE_TITLES`; `src/app-routes.js` exports `ROUTE_META` with complete, SEO-ready titles (`'Daystra — Adaptive Learning Platform | Cybercussion'`), and the old router printed them verbatim, falling back to `'<Label> — Cybercussion Interactive'`. The reference composes `title — appName`, so:
- pass **`appName: ''`** to `router.init()`, and
- give every route an explicit `title`: `ROUTE_META[slug].title` where it exists, and the literal `'<Label> — Cybercussion Interactive'` where it does not.

Keep `ROUTE_META` for `description`/`ogDescription` — only `.title` moves. Take **both** shell fixes. Theme `<link>` present. No frontend suite (`test:xt`, `test:tools`) — the smoke is the verification.

### energy/ev.cybercussion.com — 6 routes, appName `Cybercussion`
App keys: `audioLevel`, `captionsEnabled`, `autoplayEnabled`, `sessionId`, `items`. `items` is referenced nowhere outside `state.js` — drop it rather than declaring it.

```js
/**
 * Application state — the keys THIS app owns, declared where the app lives.
 * Storage keys are the historical ones: returning visitors keep their settings.
 */
import { state } from '@state';

const local = (() => { try { return globalThis.localStorage; } catch { return undefined; } })();
const session = (() => { try { return globalThis.sessionStorage; } catch { return undefined; } })();

state.define('audioLevel', { initial: 80, storage: local, storageKey: 'axiom-audioLevel',
  parse: (raw) => { const n = parseInt(raw, 10); return Number.isFinite(n) ? n : 80; } });
state.define('captionsEnabled', { initial: false, storage: local, storageKey: 'axiom-captionsEnabled', parse: (raw) => raw === 'true' });
state.define('autoplayEnabled', { initial: true, storage: local, storageKey: 'axiom-autoplayEnabled', parse: (raw) => raw !== 'false' });
state.define('sessionId', { initial: null, storage: local, storageKey: 'axiom-sessionId' });
```

Titles (5): home `EV vs Gas Savings Calculator` · map `Range & Chargers` · charge-on `Charge On — EV Myth-Busters` · compare `Compare Vehicles` · not-found `Not Found`. `garage` has none — give it one or let it show `Cybercussion`.
**Keep the home title.** ev is why the reference changed: a default route's own `title` used to be ignored. Set `title` on `home` and it renders `EV vs Gas Savings Calculator — Cybercussion`, as today. Take the **nav-orchestrator** fix; `toast-manager` is already text-safe. Verify with `npm test` + smoke.

### SCOBotPackager — a different shape; `router.js` is likely `n/a`
A two-screen Tauri shell that routes **in memory** — no history, no URL — deliberately, because `tauri://` and a location/popstate router do not mix. It imports only `auth.js`, `base-component.js`, `config.js`, `icons.js`, `index.js`, `logger.js`, `state.js`, `vt.js`. So:
- `reconcile src/core/router.js SCOBotPackager: n/a — in-memory two-screen shell, deliberately not location-routed`
- adopt what it does import (`state.js`, `logger.js`, and `observe.js`, which `state` now imports), and `base-component.js` if its components extend it.
- It has **no theme `<link>`**: BaseComponent then fetches the theme and every component waits for it. Add the link, or accept the wait. A component that owns its shadow root outright must override `render()` (the default draws a `<slot>`).
- `items` is referenced nowhere outside `state.js` — drop it rather than declaring it.

### tender.cybercussion.com — **staged, not landed**
Done and verified in Arc worktree #38 by axiom's seat, which was then blocked from landing it. Everything it needs — what changed, the verification, the finish commands — is on #tender.cybercussion.com seq 4. `npm run test:frontend` 50/50 and a smoke identical to the untouched tree.

## Status

| project | state |
|---|---|
| tender.cybercussion.com | staged in worktree #38, awaiting its seat / the operator |
| scobot.cybercussion.com | ready — clean adopt |
| daystra | ready — clean adopt, smoke is the verify |
| new.cybercussion.com | ready after an `arc sync pull`; SEO-title recipe above |
| energy/ev.cybercussion.com | ready — clean adopt |
| SCOBotPackager | partial adopt; router `n/a` |
