# Scrybe-Pattern Page Authoring for scobot-player2 — Design

**Date:** 2026-07-10 · **Branch:** `scobot-player2` · **Status:** approved by Mark
**Origin pattern:** `~/cybercussion.com/scrybe` (schema-driven conversational authoring →
validated JSON → template render). Lean port of the authoring-time primitives only —
the player's runtime Web Components remain the render target.

## Context / why

Scrybe and the player independently converged on the same architecture: a
`type`-discriminated JSON object routed through a template registry. Scrybe proved the
authoring loop (describe in chat → agent emits schema-valid JSON → Ajv gate →
no-fabrication checklist → human ship gate) for a static site. Tier 1 applies that loop
to authoring new *instances* of the player's existing templates (title-page, choice,
match, wordpuzzle, scorecard) in `data/scobot.json`. Tiers 2 (generate new template
types) and 3 (games) are explicitly out of scope.

## Decisions (2026-07-10)

1. **Tier 1 only**: new pages for existing templates; no code generation.
2. **Lean port**: copy the small primitives (Ajv validate pattern, facts/no-fabrication
   gate, skill contract shape) into this repo; register the borrow in MANIFEST.toml
   with `pattern_doc` pointing at scrybe. Factor a shared `@cybercussion/scrybe-core`
   only when a third consumer appears.
3. **Author = Mark + agent in-repo** via a Claude Code skill (`/new-page`); no in-player
   studio UI in v1.

## Deliverables

### 1. Schemas — `schemas/` (repo root; authoring-time only, never copied to dist/zip)

JSON Schema 2020-12, Ajv with `{ allErrors: true, strict: false, discriminator: true }`:

- `course.schema.json` — the whole `data/scobot.json`: `meta` (title, passingScore, …),
  `settings` (requireAnswerToAdvance, forceSequential, …), `glossary[]`, `resources[]`,
  `pages[]` (each item validated by the page union).
- `page-base.schema.json` — shared envelope: `{ id, type, title }` required;
  `objectiveId`, `weight`, `feedback` optional. `type` is the discriminator.
- One thin per-type overlay each (`allOf` base + own fields + `"type": {"const": …}`):
  `title-page`, `choice`, `match`, `wordpuzzle`, `scorecard`.

**Source of truth for fields:** what the template components actually read
(`src/features/templates/template-*.js`, `template-base.js`, plus `course-state.js`
selectors like `settings.requireAnswerToAdvance` and `meta.passingScore`). The
implementation MUST derive each schema property from the component code and cite the
consuming file in a schema `description`. No invented fields.

### 2. Golden examples — `examples/`

One canonical, schema-valid example page per type, extracted/adapted from the current
`data/scobot.json` (agents imitate concrete examples better than field docs — scrybe
spec §10). Plus `examples/course.json` showing the full-file shape in miniature.

### 3. Validator — `tools/validate-course.js`

- Compiles all schemas once; validates `data/scobot.json` (path overridable by argv).
- Output: `✅ valid` or field-level errors (`pages[3].choices: must be array`), exit 1.
- Also reports the **answers-to-confirm** list (see gate below) as a non-fatal section.
- Wired as `npm run validate`; **called by `tools/create-scorm-package.js` before
  zipping — an invalid course can never become an LMS package** (hard fail).
- `ajv` added as a devDependency (sonatype-guide check at implementation time; scrybe's
  only dependency, known-good).

### 4. No-fabrication gate (the e-learning "facts")

Scrybe's `factsToConfirm` re-aimed at correctness-critical fields: **answer keys**
(`correct` / `correctAnswer` / pairs / solution fields per type), **weights**, and
`meta.passingScore`. Implemented in the validator as a walk that lists every
answer-key field's value with its page id — the skill must present this list to the
human before a page is considered done, and the validator prints it on every run.
The skill may DRAFT distractors and prose; it must never silently invent an answer key.

### 5. Skill — `.claude/skills/new-page/SKILL.md` (in-repo, ships via GitHub)

Contract (adapted from scrybe `/studio` + `/new-post`):
1. Owner describes a page in chat → classify template type (ask if ambiguous).
2. Read the golden example for that type + the schema; draft the page object in the
   course's voice; ids kebab-case and unique within `pages[]`.
3. Append to `data/scobot.json` → run `npm run validate` → self-correct until clean
   in the same turn.
4. Present the **answers-to-confirm** checklist (answer key, weight, any passing-score
   impact) — wait for owner confirmation of correctness.
5. Preview: `npm run build` + `npx serve dist` and tell the owner where to look
   (optionally drive the browser to the new page).
6. Never commit/ship autonomously — the owner's explicit go remains the gate.
7. SCORM wiring is automatic and must be stated in the skill: `objectiveId` defaults
   to page `id`; interactive pages are counted into `setTotals` by the player at
   runtime; no extra tracking work per page.

### 6. Registry — MANIFEST.toml

New capability `conversational-page-authoring` (tags: elearning, testing, schemas,
authoring) with `pattern_doc = "../scrybe/SCRYBE.md"` and entry_points at the schemas,
validator, and skill. Honest maturity: `working` until exercised on a real new course.

## Error handling

- Validator: unreadable/unparseable scobot.json → clear error, exit 1 (never a stack trace).
- Unknown `type` in pages[] → schema error naming the allowed enum (mirrors the player's
  runtime "Unknown Page Type" error state, which stays as the runtime backstop).
- create-scorm-package refuses to zip on validation failure (message names `npm run validate`).

## Verification

1. `npm run validate` green on the CURRENT `data/scobot.json` (schemas must describe
   reality, not aspiration — if today's file has a wart, the schema documents it or the
   file gets a fix commit, decided case-by-case in review).
2. Negative tests: `tools/validate-course.test.js` (node --test, joins `test:tools`) —
   missing required field, wrong enum, duplicate page id, bad answer-key shape each
   produce the expected field-level error.
3. Dogfood run: author one new choice page end-to-end via `/new-page` (describe →
   validate → confirm answers → preview in mock LMS → verify it tracks an interaction
   + objective). This is the acceptance test.
4. `npm run scorm` still builds; the zip contains no `schemas/` or `examples/`.

## Out of scope (Tier 2/3 — future specs)

`/new-type` component generation; games; in-player studio UI; AI art; taxonomy/search;
factoring `@cybercussion/scrybe-core`.
