# Plan — auth reconciliation (spec: ../specs/2026-09-05-auth-reconciliation-design.md)

Each task is independently verifiable; run `npm run lint && npm run test:tools` after each.

1. **Helpers + tests** — `src/core/auth-helpers.js`, `tools/auth-helpers.test.js`. Test first: authorize URL params incl. `state`; `hydrateProfile` backfill order (parsed > in-memory > stored); `normalizeAvatarUrl` only rewrites a Google size suffix; `isRefreshRejected` true for status 401 / code invalid_grant, false for 500/network; `refreshDelayMs` clamps.
2. **auth.js** — wire helpers; profile persistence; scheduled keep-alive + visibility; single-flight; status/field rejection; OAuth state on both providers; avatar hardening. No callers in axiom, so lint is the only in-repo gate; behavior gates are the helper tests.
3. **docs/auth-readme.md** — runtime config contract, worker contract for refresh rejection, guard example, storage keys, downstream pull notes (per-project, kept with the fleet notesaystrom deltas).
4. **check-pwa** — opt-in aware exit; `tools/templates/sw.js`; `create-seo --pwa` writes sw + prints registration snippet; `minify.js` stamps `__BUILD_ID__` into copied `sw.js`.
5. **deploy.yml** — import-map subpath rewrite + gates.
6. **dashboard retry** — bind handler from the component.
7. Build + verify-dist; commit per task; note in MANIFEST.toml `oauth-auth-gateway` claim.
