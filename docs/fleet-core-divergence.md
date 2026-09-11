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
