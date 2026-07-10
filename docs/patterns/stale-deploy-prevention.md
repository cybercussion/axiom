# Stale-Deploy Prevention — the Axiom fleet pattern

**Origin:** axiom (canonical). **Proven in:** tender.cybercussion.com, daystrom/daystra,
new.cybercussion.com, STNG. Distilled 2026-07-10 from a cross-fleet audit after each
project had independently re-solved (and re-broken) module caching.

The problem: a zero-build Axiom SPA ships an ES-module graph whose URLs are stable
across deploys. Any cached layer — browser, CDN, service worker, import map — can pair
a *fresh* entry with *stale* dependencies (or vice versa), producing the signature
failures: "old model, missing features", intermittent
`Failed to resolve module specifier "@state"`, split-singleton state bugs.

## The contract (two layers, both required)

1. **HTML is never cached.** `/`, `/index.html`, and every SPA-fallback deep route
   serve `Cache-Control: no-store, must-revalidate`. A new deploy reaches everyone on
   the next navigation.
2. **Every code URL changes per deploy.** `tools/minify.js` stamps `?v=BUILD_ID` onto
   *all six* module surfaces (below). Fresh HTML + per-deploy URLs = no stale window,
   and code *may* be cached immutably where the host honors it.

## The six surfaces minify.js must stamp

| # | Surface | Example | Mechanism |
|---|---------|---------|-----------|
| 1 | Static imports | `from "./app-routes.js"` | `?v=` in place |
| 2 | Side-effect imports | `import "/core/focus-walker.js"` | `?v=` in place |
| 3 | Dynamic imports | `import("@features/x/x.js")` | resolve alias → absolute + `?v=` |
| 4 | **Exact aliases** | `from "@state"` (no `.js` suffix!) | resolve → `/core/state.js?v=` |
| 5 | Lazy-route data paths | `path: "@features/home/home.js"` in ROUTES | `stampRoutePaths` (`path:` key only) |
| 6 | index.html refs | entry `<script type="module">`, stylesheets, import-map *values* | `normalizeDistIndexHtml` |

Miss any one and that surface caches forever. Historical misses: #4 was the last-found
(new.cybercussion, cold-load race), #5 is invisible to import regexes (it's data, not
syntax), #6's entry tag bit STNG ("old model, missing features").

## Verified gotchas — do not re-learn these

- **Resolve aliases to absolute paths; do NOT query-stamp the bare alias.**
  `"@core/x.js?v=ID"` relying on the import-map prefix **broke prod** on
  new.cybercussion.com (2026-06-07): prefix maps with *relative* address values don't
  resolve query-bearing specifiers. Absolute resolution bypasses the runtime import
  map entirely — the form that always worked. (Nuance: *absolute* prefix values do
  resolve queries in practice — daystrom's live routes prove it — so this is a
  robustness choice, not a hard browser limit. Make it anyway.)
- **Trailing-slash import-map entries must stay bare.** Per the import-map spec a
  prefix value must end in `/` — never append `?v=` to `"@core/": "/core/"`.
- **CF Pages CONCATENATES Cache-Control across matching rules** (verified live
  2026-06-08). The specific rule does not override `/*`; `no-store` wins the merge.
  Consequence: with the required `/*` no-store catch-all, `immutable` rules on
  `/core/*` etc. are void **on Pages** — modules re-download per full page load.
  Acceptable for small graphs (~300 KB). Escapes: versioned network-first service
  worker (daystrom) or Workers Assets + `max-age=0, must-revalidate` ETag 304s (tender).
- **`/*` must carry no-store anyway** — deep SPA-fallback routes (`/dashboard`) serve
  index.html but match only the catch-all; cached, they hold a stale import map while
  fresh `?v=` modules load → intermittent resolver errors that clear on hard refresh.
- **CF Pages `_headers` globs don't recurse** — use path prefixes (`/core/*`), never
  `/*.js` (daystrom, deploy-pages.js).
- **Split-singleton guard.** Importing the same file via `@state` *and*
  `@core/state.js` yields two module instances (one stamped, one not) — two state
  singletons. `assertNoAliasConflicts()` hard-fails the build; keep it.
- **No `/src/` may survive into dist.** `assertNoSrcReferencesInDist()` hard-fails;
  vendor `lib/` is exempt (three.js legitimately contains `/src/` in doc URLs — STNG).
- **No module-preload hints for aliased entries.** Preloading resolves bare
  specifiers *before* the inline import map registers — an intermittent race (STNG,
  axiom index.html). Only preload if the build has resolved aliases to absolute paths.
- **Binary assets cache-bust by FILENAME, never query string.** Query strings confuse
  extension-based loader selection (GLTF/FBX). Convention: new bytes ⇒ new name
  (`Intro-2.mp3`), long TTL on `/assets/*` (STNG, `asset-url.js`).
- **Non-immutable hosts still need `must-revalidate` semantics.** If any router-level
  dynamic import is NOT version-stamped, code must never be `immutable` (tender's
  `_headers` note) — same URL would serve stale code after a deploy.
- **Deploy through a keychain token wrapper** (`with-cf-token.sh` / deploy-script
  resolver): inherited `CLOUDFLARE_API_TOKEN` env vars go stale after rotation and
  surface as wrangler auth errors 10000/10502 (tender, new.cybercussion).
- **Pages branch ≠ production domain.** A successful branch deploy can leave the apex
  domain on an older build if the project's Production branch differs — verify by
  curling the live `?v=` token (daystrom, cloudflare-how-to.md).

## Host decision table

| Host | Policy | Repeat-visit caching |
|------|--------|----------------------|
| CF Pages, small graph, no PWA | `/*` no-store; accept module re-download | none (fine ≲300 KB) |
| CF Pages + PWA | `/*` no-store + versioned network-first SW, `skipWaiting`, delete old caches, bypass runtime config | via SW (daystrom) |
| Workers Assets (single Worker) | HTML no-store; code `public, max-age=0, must-revalidate` → ETag 304s | cheap 304s (tender) |
| GitHub Pages | `_headers` is a no-op; rely on stamping + GH's default short TTL | GH defaults (axiom) |

## Borrowing checklist (new/updated project)

1. Copy `tools/minify.js` + `tools/minify.test.js` from **axiom** (the canonical
   copy); run `npm run test:tools` (13 tests) after any local edit.
2. Copy `_headers`, pick your row in the host table, delete the rows you rejected.
3. Keep both build guards enabled; never deploy on a guard failure.
4. Import map addresses: absolute (`/src/…`), never relative (`./src/…`).
5. Wire deploy so `npm run build` always runs first, through a keychain token wrapper.
6. Post-deploy: curl the live HTML and confirm the `?v=` token changed.
7. **Do not fork-and-drift**: improvements to stamping/guards go to axiom first, then
   re-borrow. Record status in your `MANIFEST.toml` with `pattern_doc` → this file.
