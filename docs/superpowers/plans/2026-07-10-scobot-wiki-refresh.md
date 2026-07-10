# SCOBot Wiki Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh all 19 SCOBot wiki pages to the 5.2.1 Content API, add six new pages + sidebar, and distill the agent-facing SCOBOT.md.

**Architecture:** Content work in the durable wiki clone (`~/cybercussion.com/SCOBot.wiki`, plain git — commit locally, Mark pushes). Every task grounds its API claims in the v5 source (`~/cybercussion.com/SCOBot/src/core/SCOBot.js` + SCOBotBase.js + tests/) and cross-references the inventory (`~/cybercussion.com/axiom/.superpowers/sdd/wiki-inventory.md`). SCOBOT.md goes in the SCOBot repo root (git, v5 branch).

**Tech Stack:** GitHub-flavored Markdown (wiki dialect: page links as `[[Page-Name]]`), git.

**Spec:** `docs/superpowers/specs/2026-07-10-scobot-wiki-refresh-design.md` (its Binding decisions section applies to every task verbatim).

## Global Constraints

- **scobotrte: NEVER mentioned.** Grep for it before every commit; zero tolerance.
- Domain moves in every touched page: `angular.scobot.net` → `https://scobot.cybercussion.com`; SCOBot-context `cybercussion.com` links → `https://cybercussion.com/scobot`. Tooling links where relevant: `https://cybercussion.com/scobot/packager` (SCOBot Packager — Rust multi-platform packager + LMS previewer) and `https://scobot.cybercussion.com` (the LMS).
- Every documented method must exist in 5.2.1: verify with `grep -n "<name>(" ~/cybercussion.com/SCOBot/src/core/SCOBot.js ~/cybercussion.com/SCOBot/src/connector/SCOBotBase.js` before writing its doc. Signatures from source, not memory. Settings/options only from the `scoBotDefaults` block and SCOBotBase defaults.
- Preserve-verbatim list (content-preserving edits only; method-name modernization allowed, prose untouched): General-Problems.md quirk sections; Modes/Credit Moodle gotcha.
- Style: match the wiki's existing voice (practical, first-person-plural, LMS-war-stories tone). Keep 3.x/4.x code out of NEW pages; in REWRITTEN pages replace old snippets with 5.2.1 ESM (`import { SCOBot } from '@cybercussion/scobot'`).
- Commits in the wiki clone: one per task, message `wiki: <task title>`. SCOBOT.md commits in the SCOBot repo. NO pushes anywhere — Mark's gate.
- Each content task ends with: `grep -rn "scobotrte" .` (empty) + `grep -rn "angular.scobot.net" <touched files>` (empty).

---

### Task 1: Mechanical sweep + archive banner + footer

**Files (wiki clone):** all pages (domain-move sweep); `SCOBot-removal-of-jQuery-dependency-(Audit)-for-Version-4.0.0.md` (banner); `_Footer.md`

- [ ] Sweep every `.md` for `angular.scobot.net` → `https://scobot.cybercussion.com` and audit `cybercussion.com` links (SCOBot-context ones → `/scobot`; the content.cybercussion.com image host is NOT a link move — leave). Record every change in the commit body.
- [ ] Prepend to the jQuery-audit page: `> **📜 Historical document** (2014): the audit that removed jQuery for SCOBot 4.0.0. Preserved for the record — see [[Home]] for current 5.x documentation.`
- [ ] `_Footer.md` → `Questions? [Make contact](https://cybercussion.com/scobot) · [SCOBot Packager](https://cybercussion.com/scobot/packager) · [LMS](https://scobot.cybercussion.com)`
- [ ] Validate the 5 external image URLs in Home.md (`curl -s -o /dev/null -w "%{http_code}"` each) — record results in the task report; do NOT remove dead ones (Task 7 handles Home).
- [ ] Greps per Global Constraints; commit `wiki: domain moves, archive banner, footer refresh`.

### Task 2: Core API reference rewrite (the big one)

**Files (wiki clone):** `SCORM-SCOBot-Documentation.md` (751 lines → full 5.2.1 rewrite)

- [ ] Structure: Overview & install (npm ESM + UMD) → Initialization (`new SCOBot(options)` with the REAL scoBotDefaults table from source, incl. compression, base64 default false, happyEnding, exit_type, scaled_passing_score, completion_threshold) → Lifecycle summary (initSCO/start/exitSCO/finish/suspend/timeout — link [[Lifecycle-and-Sessions]]) → Data access (setvalue/getvalue strings-only + 1.2↔2004 bridging) → Bookmarking (setBookmark/getBookmark, restored 5.2.0) → Suspend data (setSuspendData(ByPageID)/get… — link [[Suspend-Data-and-Compression]]) → Interactions (setInteraction all 9 types with the encode/decode note + `weighting` key, getInteraction restored) → Objectives (setObjective/getObjective + progress_measure maintenance via setTotals — restored essence) → Scoring & status (setTotals/gradeIt/updateStatus/happyEnding — link [[Status-Scoring-and-Progress]]) → Session info (getMode/getEntry/getSecondsFromStart/isConnectionActive vs isLMSConnected) → Comments (link [[The-Comments-API]]) → Events (the real triggerEvent surface from source: load/unload/resume/comments_lms/exception — verify each in source) → Config reference table.
- [ ] Every code block: 5.2.1 ESM style; every method verified against source per Global Constraints; each section notes "restored in 5.2.0" where applicable (setBookmark/getBookmark/getEntry/getSecondsFromStart/getInteraction/setTotals + the gradeIt gate).
- [ ] Link the live consumer: the scobot-player2 integration guide (`https://github.com/cybercussion/axiom/blob/scobot-player2/SCOBot_README.md`) as the worked example.
- [ ] Greps; commit `wiki: core API reference — 5.2.1 Content API rewrite`.

### Task 3: New API pages (five)

**Files (wiki clone, new):** `Lifecycle-and-Sessions.md`, `The-Comments-API.md`, `Status-Scoring-and-Progress.md`, `Suspend-Data-and-Compression.md`, `Utility-Methods.md`

- [ ] Lifecycle: initSCO (= initialize+start), what start() gathers (launch_data, mode/entry, suspend restore, thresholds, comments_lms), explicit initialize/terminate, exitSCO + exit_type routing, finish vs suspend vs timeout semantics (cmi.exit values), the isConnectionActive guard behavior post-5.2.1.
- [ ] Comments: getCommentsFromLMS/getCommentsFromLearner/addLearnerComment(comment, location='') — note the 4.x signature change (auto timestamp), Moodle instructor-feedback flow.
- [ ] Status/Scoring/Progress: setTotals declares totals → setObjective maintains cmi.progress_measure → gradeIt derives scaled+success and gates completion on completion_threshold (LMS-declared value wins — SCORM-correct); updateStatus at exit; happyEnding as the legacy shortcut; the 100%-gate consumer pattern (cite the player).
- [ ] Suspend & Compression: setSuspendData/ByPageID model ({pages:[]}), lz-string `compression:true`, base64 legacy flag (default flipped to false in 5.x), size limits (4k/64k per SCORM version), never-fabricate note re: legacy shapes.
- [ ] Utility: isConnectionActive vs isLMSConnected (distinct — do not conflate), checkLatency (rescued from General-Problems orphan status — verify it exists in 5.2.1 source FIRST; if absent, document it as 4.x-only with a note), getSecondsFromStart, debug(msg, lvl) callable + debug option duality, isBadValue/trueRound as public helpers (they are on the prototype).
- [ ] All methods source-verified; greps; commit `wiki: five new API pages (lifecycle, comments, scoring, suspend, utility)`.

### Task 4: Framework page + QUnit→vitest + Quick-Start

**Files (wiki clone):** `Using-SCOBot-with-AngularJS-and-Angular-2.md` (rewrite; keep filename so old links resolve), `Editing-the-QUnit-tests.md` (rewrite), `Quick-Start.md` (update)

- [ ] Framework page: retitle content "Using SCOBot with Frameworks & Modules" (H1; filename unchanged). ESM import for bundlers + native modules + import maps; the vanilla Web Component pattern with the player as the worked example; a short honest note on Angular/React/Vue (service/hook wrapping `new SCOBot`, initSCO once, terminate on teardown); explicit banner that the old `$window.SB` global pattern is 4.x-era (UMD build still supports globals for script-tag users).
- [ ] QUnit page: retitle content "Testing SCOBot (vitest)"; how the v5 repo tests run (npx vitest run, the mock APIs SCOBot_API_1484_11/MockAPI_12, the content-api.test.js pattern for new methods).
- [ ] Quick-Start: npm install + the 5.2.1 Content API quick start (mirror the npm README's — initSCO, setTotals, bookmark/per-page suspend, interaction+objective, gradeIt, finish); UMD script-tag alternative; standalone mock (`use_standalone:true`, localStorage persistence) as the no-LMS dev path; Packager + LMS links for the test loop.
- [ ] Greps; commit `wiki: framework/testing/quick-start pages to 5.2.1`.

### Task 5: Update-in-place group + gold-preservation pass

**Files (wiki clone):** `How-to-Debug.md`, `Single-Pages-Managed-by-LMS-Navigation.md`, `What's-SCOBot-doing-exactly?.md`, `The-Anti-Library.md`, `Developing-for-SCORM-2004,-but-rolling-back-to-SCORM-1.2.md`, `SCORM-Modes,-Credit-&-Behaviors.md`, `General-Problems.md`, `SCORM-Debugging-Tips.md`

- [ ] How-to-Debug: debug option + callable debug(), 5.x log prefixes, SCOverseer note kept; exit-sequence steps updated to finish/suspend semantics.
- [ ] Single-Pages: verify the adl.nav.request snippets against 5.2.1 (`sequencing.nav.request` in scoBotDefaults + finish()); mostly method-name touch-ups.
- [ ] What's-SCOBot-doing: feature overview refreshed to the 5.x pillar list (polyfill/bridge, mock LMS, compression, Content API).
- [ ] Anti-Library: ADD the disclaimer box: its example function names (initSCO/exitSCO/findAPI) coincidentally match REAL SCOBot 5.x methods — the example predates them. Otherwise content-preserving.
- [ ] 1.2-rollback: verify scorm_status_persist option still real (it is — confirm in source); modernize snippets only.
- [ ] Modes/Credit: PRESERVE the Moodle gotcha verbatim; fix only the stale v4.0.8 setvalue-blocking aside (check what 5.2.1 actually does in review mode at the LIBRARY level — read setvalue in SCOBotBase for mode guards; describe reality, and note consumers should guard writes in review mode, citing the player's isReviewMode pattern).
- [ ] General-Problems + Debugging-Tips: preserve-verbatim rule — ONLY method-name modernization inside code snippets (e.g. `SB.setvalue` forms), zero prose changes. Produce a before/after diff summary in the report proving the gold sections' prose is byte-identical.
- [ ] Greps; commit `wiki: update-in-place group; gold LMS lore preserved verbatim`.

### Task 6: Tooling page (new)

**Files (wiki clone, new):** `Tooling.md`

- [ ] Sections: **SCOBot Packager** (https://cybercussion.com/scobot/packager — Rust, macOS/Linux/Windows, bundles content AND previews against real SCORM Runtime APIs locally); **The LMS** (https://scobot.cybercussion.com — upload/verify real-runtime tracking); **npm run scorm in the reference player** (schema-validated zips; link the axiom scobot-player2 branch + AUTHORING.md conversational authoring); **SCOBot npm package** (link). scobotrte: NOT mentioned — the LMS is described as a product, never internals.
- [ ] Greps; commit `wiki: Tooling page (Packager, LMS, reference player)`.

### Task 7: Home + Sidebar

**Files (wiki clone):** `Home.md` (refresh), `_Sidebar.md` (new)

- [ ] Home: 5.2.1-era intro (npm install, ESM, one-paragraph Content API pitch), then curated nav grouped: Getting Started (Quick-Start, Frameworks, Testing) / API (Core reference + the five Task-3 pages) / SCORM Knowledge (CAM, Modes/Credit, 1.2-rollback, Is-SCORM-Secure) / Troubleshooting (General-Problems, Debugging-Tips, How-to-Debug) / Tooling / Background (Anti-Library, ID-Planning, Titles, archive page). Replace/keep images per Task 1's URL validation results (dead → remove with a note in the commit body; alive → keep).
- [ ] _Sidebar.md: the same groups as compact link lists (wiki `[[Page-Name]]` syntax).
- [ ] Greps; commit `wiki: Home + Sidebar navigation for the 5.2.1 docs`.

### Task 8: SCOBOT.md (agent contract — SCOBot repo, not wiki)

**Files:** Create `~/cybercussion.com/SCOBot/SCOBOT.md`; modify `~/cybercussion.com/SCOBot/README.md` (one pointer line under Links)

- [ ] Contract in the missive/AUTHORING.md house style: "You are integrating SCORM via @cybercussion/scobot 5.2.x" — the canonical sequence (new SCOBot(options) → initSCO → getMode/getEntry review-guard → setTotals → setBookmark + setSuspendDataByPageID per unit → setInteraction (+weighting) + setObjective per question → cmi.score.raw + gradeIt at completion → finish/suspend), the tripwires (strings only; never fabricate answer keys/ids; review mode writes nothing; interactions carry ISO8601 latency/timestamp; aliases: isLMSConnected ≠ isConnectionActive), the standalone mock dev loop, and pointers (wiki core ref, Packager, LMS, the player as reference consumer). ~100 lines, agent-neutral.
- [ ] Every method in it source-verified. scobotrte absent.
- [ ] README Links line gains `[SCOBOT.md](SCOBOT.md) (agent integration contract)`.
- [ ] Commit in the SCOBot repo (v5): `docs: SCOBOT.md agent integration contract`.

### Task 9: Accuracy sweep + final review package

**Files:** none (verification)

- [ ] Method sweep: extract every `` `method(` ``-looking token from all changed/new wiki pages + SCOBOT.md; grep each against 5.2.1 source; report any miss (must be zero or explicitly labeled "4.x-only, documented as historical").
- [ ] Gold diff proof: `git -C ~/cybercussion.com/SCOBot.wiki diff <base> -- General-Problems.md "SCORM-Modes,-Credit-&-Behaviors.md"` — prose hunks limited to the explicitly-allowed snippet modernizations.
- [ ] Link sweep: zero `angular.scobot.net`, zero `scobotrte`, all internal `[[...]]` targets exist as files.
- [ ] Produce the whole-phase review package for the final reviewer; then STOP — Mark eyeballs and owns the `git push` to the live wiki.
