# Dogfood the SCOBot 5 Content API in scobot-player2 — Design

**Date:** 2026-07-10 · **Branch:** `scobot-player2` · **Status:** approved by Mark

## Context / why

SCOBot 5 (`@cybercussion/scobot`, npm) is the ES6 rewrite of the classic SCOBot
Content API and already ships the old-format convenience methods (`start`,
`finish`, `suspend`, `setSuspendData(ByPageID)`, `setInteraction`,
`setObjective`/`getObjective`, `gradeIt`, `updateStatus`, comments API). The
scobot-player2 player, however, was written against raw
`setvalue('cmi.…')` calls — re-implementing by hand exactly what the Content
API abstracts. (Observation from Mark: agents produced a "human-shaped"
solution — longhand CMI — instead of using the abstraction the library
already provided.) This work makes the player a true dogfooding consumer and
fixes the discovered old-format gaps upstream.

## Decisions (made 2026-07-10)

1. **Scope:** player refactor + upstream gap-filling in `~/cybercussion.com/SCOBot` (→ 5.2.0).
2. **Suspend model:** old-format per-page — `setSuspendDataByPageID`; interactions live only in `cmi.interactions`; bookmark via `setBookmark`/`getBookmark`.
3. **Objectives:** per interactive page (choice/match/wordpuzzle); objective id = page id (overridable via optional `objectiveId` in scobot.json); interactions reference their objective id.
4. **Lifecycle:** `start()` on boot; on unload `finish()` when complete-and-graded, else `suspend()`; honor review mode (no writes).

## Part A — Upstream (SCOBot repo, 5.1.1 → 5.2.0)

Add to the SCOBot class (old-format names, matching existing code style):

- `setBookmark(location)` → sets `cmi.location` (string ≤1000 chars per spec); returns 'true'/'false' like siblings.
- `getBookmark()` → returns `cmi.location` value ('' when unset).
- `getInteraction(id)` → finds the interaction index by id and returns the decoded interaction object (inverse of `setInteraction`), or 'false' when absent.
- Vitest unit tests for all three (repo already uses vitest).
- Version bump to 5.2.0. Mark publishes to npm; until then the player consumes the local build (`npm link` or `file:` during dev only — the committed player `package.json` pins `^5.2.0` once published).

## Part B — Player refactor

### `src/features/player/player.js`
- `initScorm()`: keep `new SCOBot(options)`; replace `initialize()` with `start()`. After start, read `cmi.entry` / `cmi.mode`; expose `course.isReviewMode`.
- `disconnectedCallback()`: replace `syncToScorm(); terminate()` with: graded-and-complete → `finish()`, else `suspend()`. (Both imply a final commit inside SCOBot.)

### `src/core/course-state.js`
- **Bookmark:** `goToPage()` calls `scorm.setBookmark(String(index))`; restore reads `getBookmark()`.
- **Per-page suspend:** `markPageComplete()` calls `setSuspendDataByPageID(pageId, pageTitle, {complete, score, response, timestamp})`. The `{position, progress, interactions}` blob and its raw `cmi.suspend_data` writes are deleted.
- **Restore:** `restoreFromScorm()` = `getBookmark()` for position + `getSuspendDataByPageID(pageId)` per page to rebuild `courseProgress` + interaction read-back via `getInteraction(id)` (new) to rebuild in-memory `interactions`. Unparseable/legacy suspend data → start fresh (log, no throw).
- **Interactions:** `recordInteraction()` keeps `setInteraction(interaction)`; interaction objects gain `objective: <objectiveId>`; interactions are no longer duplicated into suspend data.
- **Objectives:** on interactive-page submit, `setObjective({id, score:{scaled…}, success_status, completion_status})`; `getObjective(id)` on restore for review displays.
- **Score/completion:** `syncToScorm()` shrinks to: `updateStatus(completionPercent === 100)` + `gradeIt()` (which owns score.raw/scaled/min/max + success). No raw `cmi.score.*` / `cmi.completion_status` / `cmi.success_status` writes remain.
- **Review mode:** every write action no-ops (with debug log) when `course.isReviewMode`.
- **Reset:** `resetCourseState()` keeps raw blanking loops (SCORM has no delete; legitimately below the Content API) but drops writes now owned by gradeIt/updateStatus where redundant.
- `happyEnding()` deliberately unexercised — `gradeIt()` is the honest scoring path.

### Templates (`src/features/templates/`)
- On submit, include `objectiveId` (page `objectiveId` ?? page `id`) in the `interaction-submit` event detail. No other template changes.

### `data/scobot.json`
- No structural change required. Interactive pages MAY add `objectiveId`.

## Error handling
- All Content API calls remain guarded by `isConnectionActive()`; standalone Mock-LMS fallback unchanged.
- Suspend-format migration: restore tolerates old-blob or absent data by starting fresh.

## Verification
1. **Upstream:** `npm test` green in SCOBot repo (new tests included).
2. **Player standalone (mock LMS / localStorage):** build, drive in Chrome — answer pages, suspend mid-course, relaunch and resume (bookmark + per-page state restored), complete course, inspect mock store for interactions, objectives, gradeIt score, and exit state.
3. **Real LMS:** `npm run scorm` zip → SCORM Cloud upload (Mark, manual).

## Out of scope
- SCORM 2004 sequencing/navigation requests; xAPI; multi-SCO packaging; changes to template UX; publishing 5.2.0 to npm (Mark's action).
