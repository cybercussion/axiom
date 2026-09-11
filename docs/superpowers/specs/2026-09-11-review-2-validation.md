# Validating the second review — is 10/10 worth it?

**Date:** 2026-09-11 · **Status:** evidence gathered; decisions pending (Mark) · **Input:** a second external review (8.7/10) with a nine-point "boringly defensible" hit list, taken as advisement rather than a queue.

## Answer first

Worth it for the **defensibility** half, and every item there is cheap. Each quick validation below found something real: a component that throws hangs its navigation; an aborted route's data lands on the next page; the store's prototype can be overwritten; the README's Firefox claim had never been tested. None of the fixes needs a new abstraction — they are guards, events and tests on things that exist.

The two expensive items — cross-framework benchmarks and a full demo app — make Axiom more *convincing*, not more *defensible*. They are a choice, not a gap.

## Each claim, tested

| # | Review item | Evidence (2026-09-11) | Verdict | Cost |
|---|---|---|---|---|
| 1 | A contract per primitive: inputs, outputs, lifecycle, failure, cancellation, ordering, extension points, what's unsupported | `docs/contracts.md` + `types/` cover lifecycle and rules, not per-primitive failure/cancellation/ordering. The review's A/B scenario, answered from the code: A is aborted when B starts ✓; A's component resolving late is ignored ✓ (`b56bbb7`); B's API failing still commits B with its dataKey in `error` ✓; **A's API resolving late overwrites B's data ✗** — probe: `/item/1` (slow) then `/item/2` ends on `/item/2` showing item 1 | **Do** | S |
| 2 | Invariant and fuzz tests | `mutate()`: property test added (`tests/core/state-fuzz.test.js`) — 50,000 random sequences of outcomes × settlement orders keep "initial + successes, in issue order", ~1 s; the pre-ledger code fails it on the first seed. Router: "an aborted fetch causes no state transition" **fails both ways** — a loader that ignores the signal overwrites the next page's data; one that honours it flashes `error`. Gateway: holds under `expect`; `auto` reinterprets by design | **Do** — fix query cancellation, add router invariants | S–M |
| 3 | Formal threat model; "Axiom does not make your application secure" | SECURITY.md covers XSS, tokens, CSP and limits. New: `state.set('__proto__', …)` replaces the store's prototype (the global one is untouched); `define('constructor')` shadows a built-in. JSON `__proto__` in mutate payloads is inert. Router navigation is same-origin `pushState` only | **Do** — table + a null-prototype store | S |
| 4 | Memory as the default token store | No BFF exists anywhere: Nexus (`daystra/services/nexus`) `refresh_google_token` takes the refresh token *from the browser*, and tender keeps it in localStorage. Memory by default without a BFF means every reload signs the user out. Nexus already has KV and D1 bound, so a BFF is buildable there. Reverses the 2026-09-05 decision | **Mark's call** | M, cross-repo |
| 5 | Error boundary / failure containment | **Confirmed defect:** a page whose `setup()` or `render()` throws leaves its navigation half-committed — URL and host swapped, `transitioning` stuck `true`, no focus or scroll, an uncaught error. The shell survives; the next navigation recovers. Fix without a new class: BaseComponent always resolves `rendered`, emits a cancelable `axiom:component-error`, draws a fallback inside its own shadow root | **Do** | S |
| 6 | First-class observability stream | Exists: `state.subscribe`, `router.onNavigation` (start/commit), `axiom:router-error`. Missing: navigation abort/error, mutation lifecycle, gateway request/response/error, auth login/refresh/logout | **Do, lite** — `axiom:*` events on `window` plus a small `observe()`; no hub | S–M |
| 7 | Browser support matrix | The suite, run on three engines: Chromium 19/19, WebKit 18–19/19, Firefox 18–19/19. Real: WebKit intermittently reports `ResizeObserver loop completed with undelivered notifications` as an uncaught error. Test artifact, fixed: Firefox's ordinary-Back failure came from `theme.css` smooth scrolling. **Open:** the two scroll tests flake under parallel load (e.g. 833 where 1,200 was restored); instrumented probes restore exactly on all three engines, so the leading suspect is layout settling after the restore — unproven. Chromium alone, ×10:   2 failed   18 passed (8.4s)  | **Do** — engines in CI, fix ResizeObserver, root-cause the flake | S–M |
| 8 | Performance budgets, reproducible benchmarks | Baseline, core runtime (`src/core` + BaseComponent): 30.8 KB minified · 12.8 KB gzip · 11.2 KB Brotli. Budgets for core size, transition overhead and a 10k-update microbenchmark are cheap. A fair React/Vue/Preact harness is a project of its own | Budgets **Do**; benchmarks **Mark's call** | S / L |
| 9 | Brutally honest README; "When NOT to use Axiom" | Positioning and "what Axiom isn't" exist; every count and size is CI-checked. No explicit "When NOT to use" section | **Do** | XS |
| — | A nontrivial demo built only with Axiom | The showcase covers dashboard, deep links, 404, transitions, dark mode, keyboard. Missing: CRUD, optimistic updates, slow and failed APIs, concurrent mutations, offline. A "Lab" route over a deterministic mock API would cover them and give the invariant tests a real target | **Mark's call** (Lab: M) | M–L |

## From the previous round

| Item | Finding | Proposed |
|---|---|---|
| `/login` in the template | tender, daystra and scobot each have one; tender's is the simplest (Direct Google, optional Turnstile) | Reconcile a template `/login` from tender — also fixes the dock's dead link (F10). S |
| Route announcements | `#a11y-announcer` is written by nothing in axiom **or daystra**. `announce-bus.js` is byte-identical in tender, scobot and new.cybercussion.com — and imported by nothing in any of them | Reconcile announce-bus into axiom and announce the page title on commit: the missing piece fleet-wide. S |
| Refresh-token BFF | Not solved anywhere (row 4) | Build in `daystra/services/nexus`: refresh token held server-side in KV behind an HttpOnly cookie; client `tokenStore: 'bff'`. M |
| Click-once guard | ev.cybercussion.com already had it — plus `rel="external"` as an explicit opt-out | Reconcile `rel="external"` into axiom. XS |
| GitHub protections | Public repo. On: secret scanning, push protection. Off: Dependabot alerts, Dependabot security updates, CodeQL, private vulnerability reporting | Turn on all four and add `dependabot.yml` (npm + github-actions; the actions still target deprecated Node 20). Needs Mark's OK |

## Fleet propagation

All six targets are Arc-tracked, with no git remotes. Each copy's core now differs from axiom's by 160–800 lines per file, so propagation means **re-borrowing the core** and moving app keys into the project's own `app-state.js` — one Arc intent per project — not replaying diffs.

| Project | Deploy | Tests | App keys that move to `app-state.js` | Exposed to | Notes |
|---|---|---|---|---|---|
| tender.cybercussion.com | CF Pages + workers | 0 | sessionId | double nav, scroll race, notify sink, mutate | fewest app keys — start here |
| new.cybercussion.com | CF Pages | 0 | audioLevel, captionsEnabled, autoplayEnabled, sessionId | all four | 11 self-routing components; assumed to be "cybercussion.com" |
| scobot.cybercussion.com | workers | 0 | the above + language | double nav, scroll race, mutate | LTI session model stays local |
| daystra | workers (Nexus lives here) | 10 | the above + guestId, activeStudentId, studentName | all four | the BFF work lands here too |
| ev.cybercussion.com (`energy/`) | CF Pages + worker | 11 | to inventory | scroll race only | ahead of axiom: click-once guard, text-only toasts, its own mutate |
| SCOBotPackager | Tauri binary | 8 | audioLevel, captionsEnabled, autoplayEnabled, sessionId | scroll race, mutate | ship = rebuild the binary; its CSP lives in the Tauri config, not the meta tool |

Suggested order, lowest risk first: tender → new.cybercussion.com → scobot → daystra → ev → SCOBotPackager. specula gets an update once the order and approach are decided; making the core a versioned unit is still the fleet's decision.

## If the answer is "defensibility"

- **P0** — query and gateway cancellation (an aborted navigation writes nothing) with router invariant tests for the A/B race; component failure containment; a contract per primitive, including the A/B answer; WebKit and Firefox in CI, the ResizeObserver fix, and a root cause for the scroll-test flake; a null-prototype store.
- **P1** — `axiom:*` observability events; the threat-model table and "Axiom does not make your application secure"; "When NOT to use Axiom"; a core-size budget in `tools/weigh.js` plus transition and 10k-update budgets; `/login`, route announcements, `rel="external"`.
- **Stop** when every invariant is green on three engines, the fuzz is green, ten repeated runs show no flake, and the budgets are enforced. Then add nothing.

## Progress

Decisions (Mark, 2026-09-11): work the plan in order, pushing back where it isn't worth it; auth is a placeholder — document it, don't change the default; turn on Dependabot alerts and fixes and CodeQL; propagate by re-borrowing the core per project, after axiom's P0 lands.

| Item | Status |
|---|---|
| Aborted-navigation data race (#1, #2) | **Shipped** `00e8f70` — cancellable `query()` and `gateway`; invariant tests in both loader modes (`6bf5ba0`) |
| Failure containment (#5) | **Shipped** `188a660` — `axiom:component-error`, fallback, `rendered` always resolves |
| Prototype pollution (#3) | **Shipped** `00e8f70` — null-prototype store |
| Browser matrix in CI (#7) | **Shipped** `6bf5ba0` — Chromium, WebKit, Firefox. The scroll-test flake was the test scrolling before `/components` finished laying out; the router was right. The WebKit-on-Linux flake, read from its trace: WebKit did not start a view transition for 6 s after a click (run 34629597306). The router bounds that wait at 1 s (`1314916`) — which did not cure it: run 34635441704 failed on it twice, and its traces show no timer firing for 5–9 s, the bound's own included. WebKit's main thread is blocked, most likely capturing the transition on the GPU-less runner; the suite now gives WebKit's assertions room (`601e789`). A second, on the next deploy — Back during an in-flight navigation, passed on retry: WebKit held the Back transition's update 804 ms behind the one in flight, then the scroll restore landed at 0. Not yet explained; the router now logs where each restore lands and how tall the page was (`c1f87c7`) — **open** |
| Contract per primitive (#1) | **Shipped** — `docs/contracts.md`, including the A/B answer and the test behind each guarantee |
| Threat model (#3) | **Shipped** — `SECURITY.md` |
| Auth default (#4) | **Declined** — auth is a placeholder; documented in SECURITY.md, `docs/auth-readme.md` and the contracts |
| "When NOT to use Axiom" (#9) | **Shipped** — README |
| CodeQL + Dependabot | **On.** CodeQL's first three findings are fixed (`a791a69`); the one Dependabot alert is the documented browser-sync advisory, dismissed as accepted risk |
| Benchmarks vs other frameworks (#8), Lab demo | **Pushed back** — they make Axiom more convincing, not more defensible; revisit once P1 is done |
| Route announcements, `/login`, `rel="external"` | **Shipped** — each reconciled from the fleet (announce-bus, tender, ev) |
| Performance budgets (#8) | **Shipped** `1314916` — the core's shipped size (13 KB Brotli) and layout shift (CLS < 0.1, plus race invariants) fail the deploy; the state bench is reported, not gated. Found on the way: `/components` at CLS 1.09 live — two races, both fixed, each pinned by a test that fails on the previous code |
| Observability events (#6) | **Shipped** `c1f87c7` — `axiom:navigation`, `axiom:request`, `axiom:mutation`, `axiom:auth`; every start ends exactly once; `observe()`; no headers, bodies or tokens. The core's budget rose to 14 KB to carry it |
| Next | Fleet propagation — re-borrow the core per project: tender → cybercussion.com → scobot → daystra → ev → SCOBotPackager |

