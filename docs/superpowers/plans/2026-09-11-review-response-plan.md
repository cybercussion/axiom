# Plan — review response (spec: ../specs/2026-09-11-review-response-design.md)

Gates after every task: `npm run lint && npm test`. Tasks touching build or deploy also run `npm run build && npm run verify-dist`. One commit per task; push at checkpoints. Node-testable behaviour is test-first and must fail on the prior HEAD.

**T1 — XSS sinks + inline handlers** (F2, C4)
toast renders `note.message` via `textContent`; dashboard escapes its error text; nav-dock escapes `user.picture`/`user.email` and replaces inline `onerror` with a listener; home replaces inline `onclick` with a listener. Browser-verify: `state.notify('<img src=x onerror=…>')` renders literally, executes nothing.

**T2 — `mutate()` pending ledger** (C2)
Test first: A; m1→B, m2→C; m1 fails, m2 succeeds → C. Merge: {a}; +b, +c; m1 fails → {a,c}. Both settlement orders. Implement per-key `{ confirmed, pending[] }`: display = confirmed ⊕ pending in issue order; fold successes from the front; excise failures; an external write rebases. The 16 existing tests stay green.

**T3 — `state.update(key, fn)`** (C1)
Test first. Immutable functional update that notifies; the shallow rule documented beside it.

**T4 — framework/app state split** (C8, F5)
`state.define(key, { initial, storage, storageKey })` replaces the hard-coded app keys and the persistence if-chain. Framework keys stay in core; app keys (audioLevel, captionsEnabled, autoplayEnabled, sessionId, items) move to `src/app-state.js`, imported by the modules that read them. `auth.logout` stops clearing an app key; the app reacts to `user → null`. Browser-verify nav-dock volume/captions and theme persistence.

**Checkpoint A — push, deploy green.**

**T5 — gateway `expect` + `GatewayError`** (C9)
Test first with a stubbed `fetch`: `expect: 'json'` against an HTML 200 throws `GatewayError` carrying status and content type; non-ok responses throw `GatewayError` with `.status`; default `auto` unchanged.

**T6 — public runtime config + CSP** (C4, C5)
`axiom-config.js`: a classic script that sets `window.AXIOM_CONFIG`, loaded before the modules, headed PUBLIC. `tools/csp.js` hashes the importmap and writes a `<meta>` CSP (`script-src 'self' 'sha256-…'`, `object-src 'none'`, `base-uri 'self'`; `connect-src` from config); `--check` mode gates CI. Injected at build and at deploy, after the importmap rewrite — not in the dev page, where the dev server's inline reload snippet would be blocked. Browser-verify: zero CSP violations across routes.

**T7 — pluggable token store + SECURITY.md** (C4, C5)
`auth.init({ tokenStore })`, default `local`; the bundle and profile go through the adapter. Tests for the adapters. SECURITY.md: threat model per §C4, what AXIOM_CONFIG is, why an API key there is an identifier not a secret, the BFF path, `frame-ancestors` needing a real header.

**Checkpoint B — push; browser-verify the deployed site under CSP.**

**T8 — generated declarations** (C12)
`typescript` devDep (zero transitive deps). `tsc --allowJs --declaration --emitDeclarationOnly` over `src/core` → `types/`; CI regenerates and fails on diff.

**T9 — browser tests** (C11)
Playwright devDep. Router: rapid A→B→C with A resolving last lands on C; popstate restores; guard redirect; abort on supersede. CI job.

**T10 — contracts + README** (C13)
Lifecycle, accessibility, compatibility matrix, no-SSR, core versioning + CHANGELOG. README links the ledger.

**T11 — fleet notice**
#axiom, and the fleet's reconcile channel — T4 is the convergence mechanism behind its state.js panel.
