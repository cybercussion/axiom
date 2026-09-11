# Review response — every criticism in the external architecture review, dispositioned

**Date:** 2026-09-11 · **Status:** approved for execution (Mark: "let's work it") · **Scope:** every point in the OpenAI review of 2026-09-10, plus the defects our verification of it found and it missed.

## Why this exists

The review scored Axiom 7.5/10 with P0–P2 remediations. Verification against the tree showed about a third was already stale, confirmed the rest, and found defects the review missed. This page gives **every** criticism a disposition — done, accepted, contested, or deferred with a reason — so nothing goes quiet because it was hard.

Litmus: a reader holding only the original review can tell from this page what happened to each point.

## Ledger

| # | Criticism | Verdict | Disposition |
|---|---|---|---|
| C1 | Shallow reactivity — `state.data.user.name = x` never notifies | Accept | T3 `state.update(key, fn)`; rule documented |
| C2 | `mutate()` rollback not transactional under concurrency | Accept — worse than stated | T2 pending ledger. Today a concurrent *successful* mutation's data is lost |
| C3 | README: router "200 lines" | Done | `ce99098` |
| C4 | Full token set in localStorage | Accept in part (§C4) | T1 + T6 + T7 |
| C5 | `GRAPHQL_API_KEY` in browser config | Accept | T6 + T7: config declared public, model documented |
| C6 | "zero-build" needs qualification | Done | `ce99098` |
| C7 | README oversells simplicity | Done, continued | `ce99098`, T10 |
| C8 | App state inside core `state.js` | Accept — it is also the fleet-divergence mechanism | T4 |
| C9 | Gateway content-type sniffing | Accept | T5 `expect` + `GatewayError`; auto stays default |
| C10 | Router renders errors over `document.body` | Done | `a6390fe` |
| C11 | No runtime tests | Partly done | `006c996`, `a6390fe` (node, 22 tests); T9 browser |
| C12 | JS-only public contracts | Accept (P2) | T8 declarations generated from source, drift-checked |
| C13 | "What is Axiom trying to be?" | Answered: B | §C13, T10 |
| C14 | Benchmarks vs React/Vue/Preact | Defer | §C14 |
| C15 | Restructure into core/browser/security/app dirs | Contest the move, take the intent | §C15 |
| C16 | "Don't become the thing it replaced" | Adopted as a constraint | §Constraints |

Found by verification, absent from the review:

| # | Defect | Disposition |
|---|---|---|
| F1 | `mutate()` destroyed primitive backups; threw on null inside its catch | Done `b9fa5a6` |
| F2 | Latent XSS sinks: `notify()` renders messages as HTML; dashboard error text; nav avatar/email attributes; 2 inline handlers that also block any CSP | T1 |
| F3 | 404 recovery rewrote the URL out of the deployment base path | Done `a6390fe` |
| F4 | Lockfile ignored while CI gated on `npm ci`; gates had never run | Done `bd43e52` |
| F5 | Core copied ×8, one shared bug in all | Measured `698126b`; T4 is the structural fix |

## §C4 — token storage, stated honestly

The review frames this as localStorage vs memory. That overweights storage location.

- **Script running in the page gets the tokens whatever the storage.** It can call `auth.getAccessToken()` or import the auth singleton. Memory storage does not stop XSS.
- **What storage changes is persistence.** A refresh token in localStorage lets one XSS exfiltrate a long-lived credential that keeps working from the attacker's machine after the tab closes. That is the real risk — the refresh token, not the one-hour access token.
- **Defences, strongest first:** (1) keep the refresh token out of the browser — the Direct-Google worker already brokers exchange and refresh; holding the refresh token server-side behind an HttpOnly cookie is the BFF step, a worker change owned outside this repo; (2) stop script injection — CSP `script-src` without `unsafe-inline`, and no raw HTML sinks (T1, T6); (3) refresh-token rotation with reuse detection at the IdP; (4) shorter-lived storage — shrinks the persistence window only.

**Decision: the default store stays localStorage.** The 2026-09-05 auth spec (approved) scoped storage as a downstream decision, and `loginWith` needs localStorage because some in-app browsers finish the OAuth redirect in a fresh tab with empty sessionStorage — a `session` default would break login there. T7 makes the store pluggable (`auth.init({ tokenStore })`: `local` | `session` | `memory` | adapter), and SECURITY.md states the model above.

## §C13 — direction B, already

Eight projects run copies of `src/core/`. Axiom is a general framework in fact — without a versioned contract or a single source. Where each B requirement lands:

| Requirement | Where |
|---|---|
| Lifecycle contracts | T10 — BaseComponent lifecycle |
| Test suite | node harness done; T9 browser |
| Public extension API | T4 `state.define`, T5 `expect`, `axiom:router-error` |
| Error boundaries | `axiom:router-error` (`a6390fe`) |
| SSR story | T10 — no SSR, by design, stated |
| Accessibility contract | T10 — router focus, announcer, focus-walker |
| Security model | T7 SECURITY.md |
| Plugin architecture | Contested: ES modules + the importmap are the module system (C16) |
| Versioning guarantees | T10 core semver + CHANGELOG; pairs with specula's `accept` |
| Types | T8 |
| Benchmarks | Deferred (§C14) |
| Browser compatibility matrix | T10 |

## §C14 — benchmarks, deferred

A fair four-framework benchmark is a project of its own, and its output is an argument, not a fix. Deferred until the defects above are closed. The build already reports shipped bytes; that is the number cited instead of a benchmark claim.

## §C15 — keep the paths, take the intent

Moving files into `core/ browser/ security/ app/` would break every consumer's import paths and the importmap they share — eight projects — to express a boundary. T4 draws that boundary (framework modules know nothing about any application) without moving a file.

## Constraints

- **No new top-level concept.** Every change is a function, an option, or an event on something that exists. No stores, providers, middleware, plugins.
- **Zero runtime dependencies stays true.** Dev tooling grows only where a task needs it and says why (T8 TypeScript, T9 Playwright).
- **Backward compatible by default.** Existing calls keep their behaviour; new strictness is opt-in (T5 `expect`, T7 `tokenStore`) — except where the old behaviour was the defect (T1, T2).
