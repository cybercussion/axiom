# SCOBot Wiki Refresh + SCOBOT.md — Design

**Date:** 2026-07-10 · **Status:** approved by Mark ("agreed, lets do it")
**Target:** `~/cybercussion.com/SCOBot.wiki` (durable clone of github.com/cybercussion/SCOBot.wiki.git)
**Ground truth:** `~/cybercussion.com/axiom/.superpowers/sdd/wiki-inventory.md` (19-page inventory,
method-gap analysis, page-by-page actions, domain moves) + SCOBot v5 source at
`~/cybercussion.com/SCOBot` (published 5.2.1) + the player's `SCOBot_README.md`.

## Goal

Bring the 19-page wiki (last touched 2015–2023, documenting the 3.x/4.x jQuery-era API)
up to SCOBot 5.2.1: the ES6 Content API, the restored classic methods, the corrected
lifecycle story — and distill an agent-facing `SCOBOT.md` contract (missive pattern).

## Binding decisions

1. **scobotrte is PRIVATE IP** — zero internals in any public page; reference at most
   "the LMS runtime". Hard tripwire for every task.
2. **Tooling pointers everywhere relevant**: [SCOBot Packager](https://cybercussion.com/scobot/packager)
   (Rust multi-platform packager + LMS previewer) and [scobot.cybercussion.com](https://scobot.cybercussion.com)
   (the LMS). Domain moves applied globally: `angular.scobot.net` → `scobot.cybercussion.com`;
   SCOBot-context `cybercussion.com` links → `cybercussion.com/scobot`.
3. **Preserve the gold verbatim**: the LMS-quirk lore in `General-Problems.md` and the
   Moodle graded-suspend-in-review gotcha in `SCORM-Modes,-Credit-&-Behaviors.md` are
   hard-won and NOT regenerable — content-preserving edits only (method-name updates ok).
4. **Every documented method/signature/option must exist in 5.2.1 source** — no
   aspirational API docs. The v5 repo (`src/core/SCOBot.js`, `src/connector/SCOBotBase.js`,
   `tests/`) is the source of truth; the npm README and the player's `SCOBot_README.md`
   are tone/example references.
5. **SCOBOT.md lives in the SCOBot repo root** (rides GitHub; wiki gets a pointer page
   reference). Contract-style like MISSIVE.md: init → totals → bookmark/per-page suspend
   → interactions+objectives → gradeIt → finish/suspend, with the strings-only rule and
   the escape hatch.
6. **Publish gate is Mark's**: all wiki work is committed locally in the clone; the
   `git push` to the live wiki happens only on his explicit go.

## Scope (from the inventory's action list)

- **Rewrites**: SCORM-SCOBot-Documentation.md (the 751-line core ref — apply the
  method-gap table section-by-section), Using-SCOBot-with-AngularJS-and-Angular-2.md
  (→ "Using SCOBot with Frameworks & Modules": ESM import, vanilla Web Component
  example citing the player, note for React/Vue/Angular), Editing-the-QUnit-tests.md
  (→ vitest).
- **Update-in-place**: Quick-Start (npm/ESM/UMD), How-to-Debug, Single-Pages-Managed-
  by-LMS-Navigation, What's-SCOBot-doing-exactly, The-Anti-Library (+ initSCO/exitSCO
  name-collision disclaimer), Developing-for-2004-rolling-back-to-1.2.
- **Archive banner**: the jQuery-removal audit page.
- **Keep (quirk-currency pass only)**: CAM, Is-SCORM-Secure, Titles, ID-Planning,
  Modes/Credit (fix the stale v4.0.8 setvalue-blocking aside), General-Problems,
  Debugging-Tips.
- **New pages**: Lifecycle-and-Sessions; The-Comments-API; Status-Scoring-and-Progress;
  Suspend-Data-and-Compression; Utility-Methods; Tooling (Packager + player-as-reference-
  consumer + LMS; no scobotrte internals).
- **Structure**: Home.md refresh (nav + revalidate 5 external images), NEW _Sidebar.md,
  _Footer.md refresh.
- **Agent doc**: SCOBOT.md in the SCOBot repo root.

## Verification

- Method-accuracy sweep: every code block in changed/new pages greps against 5.2.1
  source for method existence + signature arity; settings/options against scoBotDefaults.
- Gold-preservation diff: the protected passages of General-Problems.md and
  Modes/Credit appear unchanged (modulo explicitly-listed method-name fixes).
- Link sweep: no `angular.scobot.net` anywhere; image URLs return 200 (report dead ones,
  don't silently remove).
- Final: Mark eyeballs the rendered clone, then pushes (or tells me to).
