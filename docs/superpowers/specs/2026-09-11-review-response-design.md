# Review response — every criticism in the external architecture review, dispositioned

**Date:** 2026-09-11 · **Status:** approved for execution (Mark: "let's work it") · **Scope:** every point in the OpenAI review of 2026-09-10, plus the defects our verification of it found and it missed.

## Why this exists

The review scored Axiom 7.5/10 with P0–P2 remediations. Verification against the tree showed about a third was already stale, confirmed the rest, and found defects the review missed. This page gives **every** criticism a disposition — done, accepted, contested, or deferred with a reason — so nothing goes quiet because it was hard.

Litmus: a reader holding only the original review can tell from this page what happened to each point.

## Ledger

Status as of 2026-09-11; hashes are on `main`.

| # | Criticism | Verdict | Disposition |
|---|---|---|---|
| C1 | Shallow reactivity — `state.data.user.name = x` never notifies | Accept | **Shipped** `76b25b0` — `state.update()`; the rule is pinned by a characterization test |
| C2 | `mutate()` rollback not transactional under concurrency | Accept — worse than stated | **Shipped** `5e0b135` — per-key pending ledger; a concurrent *successful* write was being lost |
| C3 | README: router "200 lines" | Done | `ce99098`; README numbers now CI-checked (`6c3dc49`) |
| C4 | Full token set in localStorage | Accept in part (§C4) | **Shipped** — sinks `6564943`, CSP `354098c`, `tokenStore` `76f0a99`, SECURITY.md `adb0cc5`. **Open:** the BFF step — a worker change, outside this repo |
| C5 | `GRAPHQL_API_KEY` in browser config | Accept | **Shipped** — public `axiom-config.js` (`354098c`); model in SECURITY.md (`adb0cc5`) |
| C6 | "zero-build" needs qualification | Done | `ce99098` |
| C7 | README oversells simplicity | Done | `6c3dc49` — rewritten; numbers CI-checked |
| C8 | App state inside core `state.js` | Accept | **Shipped** `124b2c2`, guarded by a test; the router's app coupling followed (F8, `5e90a18`) |
| C9 | Gateway content-type sniffing | Accept | **Shipped** `b9413f1` |
| C10 | Router renders errors over `document.body` | Done | `a6390fe` |
| C11 | No runtime tests | Accept | **Shipped** — node suite (`006c996` onward); browser suite under the production CSP (`abb935a`) |
| C12 | JS-only public contracts | Accept (P2) | **Shipped** `0351282` — generated `types/`; misuse pinned in a contract |
| C13 | "What is Axiom trying to be?" | Answered: B | §C13; [docs/contracts.md](../../contracts.md) |
| C14 | Benchmarks vs React/Vue/Preact | Defer | §C14 |
| C15 | Restructure into core/browser/security/app dirs | Contest the move, take the intent | §C15 |
| C16 | "Don't become the thing it replaced" | Adopted as a constraint | Held: every change was a function, an option or an event |

Found by verification, absent from the review:

| # | Defect | Disposition |
|---|---|---|
| F1 | `mutate()` destroyed primitive backups; threw on null inside its catch | Fixed `b9fa5a6` |
| F2 | Latent XSS sinks: `notify()` rendered HTML; dashboard error text; nav avatar/email attributes; inline handlers | Fixed `6564943` |
| F3 | 404 recovery rewrote the URL out of the base path | Fixed `a6390fe` |
| F4 | Lockfile ignored while CI gated on `npm ci`; the gates had never run | Fixed `bd43e52` |
| F5 | Core copied ×8, one shared bug in all | Measured `698126b`; convergence mechanism `124b2c2`; the decision is the fleet's |
| F6 | Every nav click navigated twice — two history entries; Back took two presses | Fixed `dec76fb` — found by the browser suite |
| F7 | A navigation superseded mid-commit still scrolled and saved — a fast Back lost its position | Fixed `b56bbb7` — found by the browser suite |
| F8 | Router still carries app coupling (`ROUTE_TITLES`, the `/login` guard redirect) and dead code (an `env-config.js` lookup, `_scrollTimeout`) | **Fixed** `5e90a18` — titles are route config; `appName` and `loginPath` are init options; the dead code is gone |
| F9 | `#a11y-announcer` is declared but never written — route changes are not announced to screen readers | Fixed — `@core/announce.js`, reconciled from the fleet's unused announce-bus; the router announces each committed route after the first |
| F10 | The dock's Login link targets a feature that does not exist in axiom (404) | Fixed — a template `/login`, reconciled from a downstream project; it says so when no provider is configured |
| F11 | browser-sync carries 3 high advisories (dev-only); the obvious override silently kills live reload | Accepted, documented `39231a7` |

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
| Versioning guarantees | T10 core semver + CHANGELOG; pairs with the fleet's convergence decision |
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
