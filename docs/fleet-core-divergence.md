# Fleet core divergence — measured 2026-09-10

Axiom is upstream for the fleet's core, but the core is **copied, not consumed**.
The copies have drifted, and a fix landing here does not reach them.

## Measurement

`src/core/state.js`, all copies on this machine, diffed against axiom:

| project                   | LOC | lines differing | sha256 (first 12) | broken rollback |
|---------------------------|-----|-----------------|-------------------|-----------------|
| **axiom** (upstream)      | 179 | —               | `30b84d5f11fa`    | fixed           |
| daystra                   | 187 | 30              | `2b7957c8b39f`    | **present**     |
| kyber                     | 156 | 41              | `9075a3c7a150`    | **present**     |
| new.cybercussion.com      | 175 | 18              | `1fce5a1ed8d5`    | **present**     |
| SCOBotPackager            | 175 | 18              | `1fce5a1ed8d5`    | **present**     |
| scobot.cybercussion.com   | 181 | 24              | `39298b5317dd`    | **present**     |
| STNG                      | 212 | 55              | `86747087c32e`    | **present**     |
| tender.cybercussion.com   | 169 | 24              | `8c612ee82edd`    | **present**     |

8 copies, **7 distinct hashes** — independently reproducing what specula
escalated as `p-MZ4HWHHVZ0`. Divergence runs 18–55 lines. `router.js` (8 copies,
8 hashes, `p-J4442V8WB3`) and `theme.css` (9 copies, 9 hashes, `p-3JRN110P3X`)
are escalated on the same grounds.

## Why this is not merely untidy

The `mutate()` rollback bug fixed in axiom `b9fa5a6` is present, **byte-identical
including its comment**, in all seven other projects:

```js
const safeBackup = { ...backup, status: (backup.status === 'syncing' ? 'success' : backup.status) };
```

A primitive backup is destroyed (`5` → `{}`), a string is corrupted into a char
map, and a null backup throws a TypeError *inside the catch block* — replacing
the caller's real error, skipping the failure toast, and pinning status at
`syncing`.

So the divergence is not a hygiene concern to schedule later. One bug, one line,
seven live projects, and the fix currently reaches one of them. The regression
suite added in `006c996` covers only axiom's copy.

## What is actually needed

Propagating this fix by hand is seven more edits and seven more hashes — it makes
the table worse, not better. The real options are the three specula escalations,
which carry `authority:fleet`:

- **accept** — make the core a versioned, consumable unit that projects depend on
  rather than copy, and migrate the eight.
- **kill** — declare the copies independent forks, drop the pretense of a shared
  upstream, and fix each on its own schedule.
- **defer** — leave as is, accepting that core fixes reach one project at a time.

This document records the measurement so whoever holds that authority decides
against numbers rather than impressions. It deliberately does **not** decide.

## Addendum — 2026-09-11: this session's fixes, across the copies

The review response fixed three more defects in axiom's core. Checked against the seven other copies on this machine. These are **grep-level exposure checks, not executions** — treat each cell as "exposed", not "proven broken".

| project | click handled once (`defaultPrevented`) | components that route their own clicks | superseded-commit re-check | `notify()` renders HTML |
|---|---|---|---|---|
| daystra | no | 7 files | missing | yes |
| kyber | no | 2 | missing | yes |
| new.cybercussion.com | no | 11 | missing | yes |
| scobot.cybercussion.com | no | 4 | missing | — |
| SCOBotPackager | no | 0 | missing | — |
| STNG | no | 0 | missing | — |
| tender.cybercussion.com | no | 1 | missing | yes |

- **Double navigation** (axiom `dec76fb`). A copy whose components route their own link clicks *and* keeps the router's document listener navigates twice per click: two history entries, Back takes two presses. Five of seven have self-routing components. All seven also swallow `target="_blank"`, download and shift/alt clicks into in-page navigation.
- **Fast-Back scroll loss** (`b56bbb7`). Every copy awaits `rendered` without re-checking the navigation id, so a navigation that lost can still scroll and save after a newer one started.
- **`notify()` HTML sink** (`6564943`). Four copies render toast messages with `innerHTML` — an XSS sink for any caller passing server or URL text.
- And the `mutate()` rollback bug above, still in all seven.

Each fix is small. Hand-porting them seven times deepens the divergence this document measures; they are the strongest argument yet for specula's `accept` path — one core, versioned, consumed.

Method: `defaultPrevented` in `src/core/router.js`; `router.handleIntercept|router.navigate(link` across `src/`, excluding the router; `featureEl.rendered` present with no `_committedNavId`; the literal `${note.message}` in `src/shared/toast-manager.js`.

## The reference — 2026-09-11 (specula #12, step 1)

axiom's core is the reconcile reference, declared CANONICAL in `MANIFEST.toml` (`canonical-runtime-core`, `5e90a18`). Hashes are sha256, first 12 hex — the cut specula's matrices use.

| file | reference hash | lines | a consumer |
|---|---|---|---|
| `src/core/router.js` | `d13dd2347965` | 643 | adopt byte-for-byte; give routes a `title`, pass `appName` (and `loginPath` if not `/login`) to `router.init()` |
| `src/core/state.js` | `270f7305bc28` | 362 | adopt byte-for-byte; move your app keys into your own `app-state.js` with `state.define()` |
| `src/core/gateway.js` | `226178011217` | 232 | adopt — or, where your gateway is genuinely your own, take `expect`, `GatewayError`, `{ signal }` and the `axiom:request` events |
| `src/core/logger.js` | `daf9325dc814` | 32 | adopt (messages are no longer read as format directives) |
| `src/core/observe.js` | `710eca332ff9` | 61 | new — adopt; router, state and gateway import it |
| `src/core/announce.js` | `304d8d28d124` | 77 | new — adopt; the router announces route changes through it |
| `src/core/focus-walker.js` | `012ae4963f9a` | 113 | adopt |
| `src/shared/base-component.js` | `6e09da395f30` | 273 | adopt; link `theme.css` in your `<head>` before the module scripts |
| `src/shared/styles/theme.css` | `97a0da3d7a12` | 715 | not byte-adopted — the token set is the contract, with #65's rename map |

**What a consumer provides** — the core imports these, and they stay the app's:

- `@core/config.js` exporting `config` with: `API_BASE`, `BASE_PATH`, `ENV`, `GRAPHQL_API_KEY`, `GRAPHQL_ENDPOINT`, `NAV_STYLE`, `VERSION`.
- `@core/auth.js` exporting `auth` with: `getAccessToken()`, `isAuthenticated()`. Emitting `axiom:auth` is optional.
- An `app-state.js` that declares the app's own keys with `state.define()`, imported before anything reads them.
- `router.init({ routes, appName, loginPath })`, each route with its `title`.
- `<link rel="stylesheet" href=".../styles/theme.css">` in the `<head>`, ahead of the module scripts — BaseComponent reads the shadow theme from it.
- If it ships a `dist/`: the canonical build, `tools/minify.js` — it stamps the lazy-route paths the router no longer stamps itself.

What breaks for a copier is listed under "Breaking" in [CHANGELOG.md](../CHANGELOG.md).

**The axiom rows of #11, closed** (in #13's format):

- `reconcile src/core/router.js axiom: adopted — the reference: all four fix islands, plus the double-navigation, superseded-commit, stalled-transition and app-coupling fixes — verify: npm test && AXIOM_ENGINES=chromium,webkit,firefox npm run e2e`
- `reconcile src/core/state.js axiom: adopted — the reference: the per-key mutate ledger, cancellable query, null-prototype store, no app keys — verify: npm test`
- `reconcile src/shared/styles/theme.css axiom: adopted — the token set of record (77 tokens); bytes are expected to differ per project — verify: npm run lint:motion`

**#12 (1c), the `localhost` block in six copies of `state.js`:** it does not belong in the core. In tender it is an empty `if (location.hostname === 'localhost') {}` inside the store's `set` trap — dead code on every write. Adopting the reference drops it.

**Correction, ba2d961:** the router's title rule no longer ignores a default route's own `title` (it showed `appName` alone). The reference router is now `d13dd2347965`; the row above carries it. Consumers whose home page has a title of its own — ev.cybercussion.com — keep it.
