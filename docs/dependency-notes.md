# Dependency notes

## browser-sync → immutable (GHSA-v56q-mh7h-f735) — ACCEPTED, do not "fix"

`npm audit` reports **3 high-severity** advisories. All three trace to one
dependency:

```
browser-sync@3.0.4
├── immutable@3.8.4          ← GHSA-v56q-mh7h-f735
└── browser-sync-ui@3.0.4
    └── immutable@3.8.4
```

`List` 32-bit trie overflow → unrecoverable DoS.

### Why it is not fixed upstream

- `browser-sync@3.0.4` is already the **latest** release.
- `immutable@3.8.4` is the **last 3.x**. The fix exists only in 4.x/5.x.
- `npm audit fix --force` resolves to `browser-sync@1.9.2` — a 2015 release.
  That is not a fix, it is a decade-long downgrade of the dev server.

### The override was tested and REJECTED

`overrides: { "immutable": "^5.1.9" }` resolves cleanly and looks healthy:
browser-sync boots, serves 200, the socket endpoint answers 200, the UI on
:3001 answers 200, the served body is byte-identical to stock, and **nothing is
logged**.

It is still broken. Measured against a stock control on the same machine, same
node (v22.23.2), same flags, run in both orders:

| tree                    | boot | serve | socket | UI  | file-change → reload |
|-------------------------|------|-------|--------|-----|----------------------|
| stock (immutable 3.8.4) | ok   | 200   | 200    | 200 | **1 event**          |
| override (immutable 5)  | ok   | 200   | 200    | 200 | **0 events**         |

The override silently kills file watching — the entire reason browser-sync is
here — while turning `npm audit` green and printing no error. Anyone auditing by
the advisory count alone would ship a dead dev loop and a clean report.

**Falsifier** (cheapest out-of-band test that would refute this):

```sh
mkdir -p /tmp/bs/www && cd /tmp/bs
printf '<!doctype html><html><body><h1>p</h1></body></html>' > www/index.html
npm i -D browser-sync@3.0.4            # add overrides.immutable ^5 for the other arm
npx browser-sync start --server www --files 'www/**/*' --port 3095 --no-open --no-notify > w.log 2>&1 &
echo '<p>x</p>' >> www/index.html
grep -ic 'file event\|reload' w.log     # stock: >=1, override: 0
```

### Standing assessment

Dev-only. `browser-sync` is not in the shipped surface — the deploy workflow
removes `node_modules` and uploads source, and nothing in `devDependencies`
reaches a user. The DoS needs a `List` near 2^32 entries; browser-sync uses
Immutable for internal option state, which is a handful of keys.

Accepted risk. Re-evaluate if browser-sync ships a release that moves off
immutable 3.

### The open alternative (needs a workflow decision, not a drive-by)

`browser-sync` is **145 of 238 packages — 61% of the dependency tree** and the
sole source of every current advisory. Dropping it would leave 93. `npm start`
already serves the SPA without it (`npx serve -s .`); only live-reload would be
lost, and a watch+SSE reloader is ~50 lines of platform code, which is squarely
in this project's idiom. Not done here because it changes the daily dev loop.
