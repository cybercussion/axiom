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
