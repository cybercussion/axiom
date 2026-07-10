# Scrybe-Pattern Page Authoring (Tier 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conversational page authoring for the SCORM player — JSON Schemas per template type, an Ajv validator with an answers-to-confirm gate, golden examples, package-time enforcement, and a `/new-page` skill.

**Architecture:** Scrybe's authoring-time layer, lean-ported: per-type schemas (`allOf` over a shared page base) compiled by one validator module (`tools/validate-course.js`) that routes each page to its type's compiled validator (scrybe's exact architecture — NOT a JSON-Schema `oneOf` union), plus a JS-level duplicate-id check and an answer-key walk. `create-scorm-package.js` imports the validator and refuses to zip invalid courses. The runtime player is untouched.

**Tech Stack:** JSON Schema 2020-12, Ajv (devDependency, ESM `ajv/dist/2020.js`), `node:test` (joins the existing `npm run test:tools` glob), vanilla Node tools scripts matching `tools/minify.js` idioms.

**Spec:** `docs/superpowers/specs/2026-07-10-scrybe-page-authoring-design.md`

## Global Constraints

- Repo `/Users/markstatkus/cybercussion.com/axiom`, branch `scobot-player2`. 2-space indent, ESM, `pathToFileURL` main-guard for tools that are both importable and executable (copy the idiom from `tools/minify.js` bottom).
- `schemas/` and `examples/` live at repo root and must NEVER reach `dist/` or the SCORM zip (minify.js only copies listed dirs — do not add them; Task 4 asserts this).
- `npm run validate` MUST pass on the CURRENT `data/scobot.json` unchanged — schemas describe reality. Every schema property carries a `description` naming its consuming file (e.g. `"read by src/features/templates/template-choice.js"`).
- The skill may draft distractors/prose; it must NEVER silently invent answer keys, weights, or passing scores — those go on the answers-to-confirm checklist.
- `ajv` is the only new dependency (devDependency). Run the sonatype-guide check before installing; abort and report if it flags anything.
- `tools/minify.js` and all `src/` runtime code are OUT OF SCOPE — do not modify.
- Commit after every task.

## Ground truth (verified 2026-07-10 — field inventory per type)

From the live `data/scobot.json` + component reads (`template-base.js`: `pageData?.{id,objectiveId,weight,feedback}`; `template-choice.js`: `.choices`; `template-match.js`: `.pairs`):

- **base (all pages):** `id` (kebab string), `type` (enum), `title` (string); optional `objectiveId`, `weight` (number ≥ 0), `feedback` `{correct, incorrect}` (strings).
- **title-page:** optional `subtitle`, `image` (string path), `objectives` (string[]), `duration` (string).
- **choice:** `question` (string), `multiSelect` (boolean), `choices` (array ≥ 2 of `{id, text, correct:boolean}`).
- **match:** `question`, `pairs` (array ≥ 2 of `{sourceId, sourceText, targetId, targetText}`).
- **wordpuzzle:** `question`, `text` (string with `{{blankId}}` tokens), `blanks` (array ≥ 1 of `{id, answers: string[] ≥ 1}`).
- **scorecard:** optional `showDetails`, `showReview` (booleans), `completionMessage`, `passMessage`, `failMessage` (strings).
- **course:** `meta` `{title required; description, version, author, scormVersion, passingScore(number), masteryScore, maxAttempts, timeLimit}`, `settings` (7 booleans: allowReview, showFeedback, shuffleChoices, forceSequential, showProgress, requireAnswerToAdvance, showResetButton), `pages` (array ≥ 1), `glossary` (array of `{term, definition}`), `resources` (array of `{title, url, type}`).
- **Answer-key fields (the no-fabrication gate):** `choices[].correct` (choice), the `pairs[]` pairing itself (match), `blanks[].answers` (wordpuzzle), every `weight`, `meta.passingScore`, `meta.masteryScore`.

---

### Task 1: Ajv + base/choice schemas + validator core

**Files:**
- Create: `schemas/page-base.schema.json`, `schemas/choice.schema.json`
- Create: `tools/validate-course.js`
- Test: `tools/validate-course.test.js`
- Modify: `package.json` (devDependency + `validate` script)

**Interfaces:**
- Produces: `validateCourse(filePath) → { valid: boolean, errors: string[], answersToConfirm: string[] }` (answersToConfirm empty until Task 3); `PAGE_TYPES` export (array of known type strings). CLI: `node tools/validate-course.js [path]` exits 1 on invalid.

- [ ] **Step 1: Vet + install ajv**

Run the sonatype-guide check for npm package `ajv` (latest 8.x). If clean:
```bash
cd /Users/markstatkus/cybercussion.com/axiom && npm install -D ajv
```
Expected: added to devDependencies, no vulnerabilities flagged.

- [ ] **Step 2: Write the base schema**

Create `schemas/page-base.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "page-base",
  "type": "object",
  "description": "Shared page envelope. Consumed by src/features/player/player.js (TEMPLATE_REGISTRY routing) and src/features/templates/template-base.js.",
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[a-z0-9][a-z0-9-]*$",
      "description": "Unique kebab-case page id. Becomes the SCORM interaction id (template-base.js interactionId) and default objective id."
    },
    "type": {
      "type": "string",
      "description": "Template discriminator — routes via TEMPLATE_REGISTRY in src/features/player/player.js."
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "description": "Page heading; also the SCORM objective description (course-state.js recordInteraction)."
    },
    "objectiveId": {
      "type": "string",
      "description": "Optional SCORM objective id override; defaults to page id (template-base.js)."
    },
    "weight": {
      "type": "number",
      "minimum": 0,
      "description": "Scoring weight (template-base.js get weight; course.score in course-state.js). ANSWER-KEY FIELD."
    },
    "feedback": {
      "type": "object",
      "description": "Shown by template-base.js showFeedback.",
      "properties": {
        "correct": { "type": "string" },
        "incorrect": { "type": "string" }
      },
      "additionalProperties": false
    }
  },
  "required": ["id", "type", "title"]
}
```

- [ ] **Step 3: Write the choice schema**

Create `schemas/choice.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "choice",
  "allOf": [{ "$ref": "page-base" }],
  "type": "object",
  "description": "Multiple-choice question. Rendered by src/features/templates/template-choice.js.",
  "properties": {
    "type": { "const": "choice" },
    "question": { "type": "string", "minLength": 1 },
    "multiSelect": {
      "type": "boolean",
      "description": "true = select-all-that-apply (checkboxes); false = single answer (radios)."
    },
    "choices": {
      "type": "array",
      "minItems": 2,
      "description": "Read by template-choice.js (this.pageData.choices).",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string", "minLength": 1 },
          "text": { "type": "string", "minLength": 1 },
          "correct": { "type": "boolean", "description": "ANSWER-KEY FIELD — never fabricated by the authoring skill." }
        },
        "required": ["id", "text", "correct"],
        "additionalProperties": false
      }
    }
  },
  "required": ["question", "multiSelect", "choices"]
}
```

- [ ] **Step 4: Write the failing tests**

Create `tools/validate-course.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { validateCourse, PAGE_TYPES } from './validate-course.js';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-course-'));

function writeCourse(name, obj) {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
  return p;
}

const VALID_CHOICE_PAGE = {
  id: 'q-sample',
  type: 'choice',
  title: 'Sample',
  question: 'Pick one:',
  multiSelect: false,
  choices: [
    { id: 'a', text: 'Right', correct: true },
    { id: 'b', text: 'Wrong', correct: false }
  ],
  weight: 1
};

const MINIMAL_COURSE = {
  meta: { title: 'T' },
  settings: {},
  pages: [VALID_CHOICE_PAGE]
};

test('a minimal valid course passes', () => {
  const r = validateCourse(writeCourse('ok.json', MINIMAL_COURSE));
  assert.deepEqual(r.errors, []);
  assert.equal(r.valid, true);
});

test('missing required field produces a field-level error path', () => {
  const bad = structuredClone(MINIMAL_COURSE);
  delete bad.pages[0].question;
  const r = validateCourse(writeCourse('missing.json', bad));
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.includes("pages[0]") && e.includes('question')), r.errors.join('\n'));
});

test('unknown page type names the allowed types', () => {
  const bad = structuredClone(MINIMAL_COURSE);
  bad.pages[0].type = 'essay';
  const r = validateCourse(writeCourse('unknown.json', bad));
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.includes('essay') && PAGE_TYPES.every(t => e.includes(t))), r.errors.join('\n'));
});

test('unreadable file is a clean error, not a throw', () => {
  const r = validateCourse(path.join(TMP, 'nope.json'));
  assert.equal(r.valid, false);
  assert.equal(r.errors.length, 1);
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `node --test tools/validate-course.test.js`
Expected: FAIL — `Cannot find module ... validate-course.js`

- [ ] **Step 6: Implement the validator core**

Create `tools/validate-course.js`:

```javascript
/**
 * Project Axiom: Course Validator (scrybe pattern — lean port)
 * Validates data/scobot.json against schemas/: one compiled Ajv validator
 * per page type, routed by page.type (NOT a oneOf union — clearer errors),
 * plus JS-level checks JSON Schema can't express (duplicate page ids).
 * Pattern origin: ~/cybercussion.com/scrybe templates/validate.js.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import Ajv2020Module from 'ajv/dist/2020.js';
// Ajv ships CJS; under node ESM interop the class may sit on .default.
const Ajv2020 = Ajv2020Module.default ?? Ajv2020Module;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SCHEMA_DIR = path.join(ROOT_DIR, 'schemas');

// Page types with a schema file present. Task 2 completes the set;
// keep this list in sync with TEMPLATE_REGISTRY in src/features/player/player.js.
export const PAGE_TYPES = fs.readdirSync(SCHEMA_DIR)
  .filter(f => f.endsWith('.schema.json') && !['page-base.schema.json', 'course.schema.json'].includes(f))
  .map(f => f.replace('.schema.json', ''))
  .sort();

function loadSchema(name) {
  return JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, `${name}.schema.json`), 'utf8'));
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addSchema(loadSchema('page-base'));
const pageValidators = {};
for (const type of PAGE_TYPES) {
  pageValidators[type] = ajv.compile(loadSchema(type));
}
let courseValidator = null;
if (fs.existsSync(path.join(SCHEMA_DIR, 'course.schema.json'))) {
  courseValidator = ajv.compile(loadSchema('course'));
}

function formatErrors(prefix, ajvErrors) {
  return (ajvErrors || []).map(e => `${prefix}${e.instancePath || ''} ${e.message}`.trim());
}

/**
 * @param {string} filePath course JSON path
 * @returns {{ valid: boolean, errors: string[], answersToConfirm: string[] }}
 */
export function validateCourse(filePath) {
  let course;
  try {
    course = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return { valid: false, errors: [`cannot read/parse ${filePath}: ${err.message}`], answersToConfirm: [] };
  }

  const errors = [];

  if (courseValidator && !courseValidator(course)) {
    errors.push(...formatErrors('course', courseValidator.errors));
  }

  const pages = Array.isArray(course.pages) ? course.pages : [];
  const seenIds = new Set();
  pages.forEach((page, i) => {
    const where = `pages[${i}]`;
    const type = page?.type;
    if (!pageValidators[type]) {
      errors.push(`${where}.type "${type}" is not a known template — allowed: ${PAGE_TYPES.join(', ')}`);
      return;
    }
    const validate = pageValidators[type];
    if (!validate(page)) {
      errors.push(...formatErrors(where, validate.errors));
    }
    if (page.id) {
      if (seenIds.has(page.id)) errors.push(`${where}.id "${page.id}" duplicates an earlier page id`);
      seenIds.add(page.id);
    }
  });

  return { valid: errors.length === 0, errors, answersToConfirm: collectAnswerKeys(course) };
}

// Task 3 fills this in (the no-fabrication gate). Empty until then.
function collectAnswerKeys(course) {
  return [];
}

// CLI: node tools/validate-course.js [path]
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = process.argv[2] || path.join(ROOT_DIR, 'data', 'scobot.json');
  const { valid, errors, answersToConfirm } = validateCourse(target);
  if (!valid) {
    console.error(`\n❌ ${path.relative(ROOT_DIR, target)} is INVALID:\n`);
    errors.forEach(e => console.error(` - ${e}`));
    process.exit(1);
  }
  console.log(`✅ ${path.relative(ROOT_DIR, target)} is valid (${PAGE_TYPES.length} page types known).`);
  if (answersToConfirm.length) {
    console.log('\n🔑 Answers to confirm (never fabricated — a human must verify these):');
    answersToConfirm.forEach(a => console.log(` - ${a}`));
  }
}
```

- [ ] **Step 7: Add the npm script**

In `package.json` scripts, after `"verify-dist"`:
```json
    "validate": "node tools/validate-course.js",
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `node --test tools/validate-course.test.js`
Expected: 4 tests PASS. (The real `data/scobot.json` is NOT expected to pass yet — match/wordpuzzle/etc. schemas arrive in Task 2.)

- [ ] **Step 9: Commit**

```bash
git add schemas/ tools/validate-course.js tools/validate-course.test.js package.json package-lock.json 2>/dev/null; git add schemas/ tools/validate-course.js tools/validate-course.test.js package.json
git commit -m "feat(authoring): Ajv course validator core + page-base/choice schemas (scrybe pattern)"
```
(Note: package-lock.json is gitignored in this repo — the first `git add` form tolerates that.)

---

### Task 2: Remaining schemas + green on the real course

**Files:**
- Create: `schemas/title-page.schema.json`, `schemas/match.schema.json`, `schemas/wordpuzzle.schema.json`, `schemas/scorecard.schema.json`, `schemas/course.schema.json`
- Modify: `tools/validate-course.test.js` (append)

**Interfaces:**
- Consumes: Task 1's validator (auto-discovers new `*.schema.json` files via `PAGE_TYPES`).
- Produces: full schema set; `npm run validate` green on `data/scobot.json`.

- [ ] **Step 1: Write the four page schemas**

`schemas/title-page.schema.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "title-page",
  "allOf": [{ "$ref": "page-base" }],
  "type": "object",
  "description": "Informational/cover page (auto-completes). Rendered by src/features/templates/template-title.js.",
  "properties": {
    "type": { "const": "title-page" },
    "subtitle": { "type": "string" },
    "image": { "type": "string", "description": "Path under public/ or assets/." },
    "objectives": { "type": "array", "items": { "type": "string" } },
    "duration": { "type": "string", "description": "Human-readable, e.g. \"15 minutes\"." }
  }
}
```

`schemas/match.schema.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "match",
  "allOf": [{ "$ref": "page-base" }],
  "type": "object",
  "description": "Matching interaction. Rendered by src/features/templates/template-match.js (this.pageData.pairs).",
  "properties": {
    "type": { "const": "match" },
    "question": { "type": "string", "minLength": 1 },
    "pairs": {
      "type": "array",
      "minItems": 2,
      "description": "The pairing IS the answer key (ANSWER-KEY FIELD).",
      "items": {
        "type": "object",
        "properties": {
          "sourceId": { "type": "string", "minLength": 1 },
          "sourceText": { "type": "string", "minLength": 1 },
          "targetId": { "type": "string", "minLength": 1 },
          "targetText": { "type": "string", "minLength": 1 }
        },
        "required": ["sourceId", "sourceText", "targetId", "targetText"],
        "additionalProperties": false
      }
    }
  },
  "required": ["question", "pairs"]
}
```

`schemas/wordpuzzle.schema.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "wordpuzzle",
  "allOf": [{ "$ref": "page-base" }],
  "type": "object",
  "description": "Fill-in-the-blanks. Rendered by src/features/templates/template-wordpuzzle.js. text contains {{blankId}} tokens matching blanks[].id.",
  "properties": {
    "type": { "const": "wordpuzzle" },
    "question": { "type": "string", "minLength": 1 },
    "text": { "type": "string", "minLength": 1 },
    "blanks": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string", "minLength": 1 },
          "answers": {
            "type": "array",
            "minItems": 1,
            "items": { "type": "string", "minLength": 1 },
            "description": "Accepted answers (ANSWER-KEY FIELD)."
          }
        },
        "required": ["id", "answers"],
        "additionalProperties": false
      }
    }
  },
  "required": ["question", "text", "blanks"]
}
```

`schemas/scorecard.schema.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "scorecard",
  "allOf": [{ "$ref": "page-base" }],
  "type": "object",
  "description": "Results page (usually last; triggers final grading). Rendered by src/features/templates/template-scorecard.js.",
  "properties": {
    "type": { "const": "scorecard" },
    "showDetails": { "type": "boolean" },
    "showReview": { "type": "boolean" },
    "completionMessage": { "type": "string" },
    "passMessage": { "type": "string" },
    "failMessage": { "type": "string" }
  }
}
```

- [ ] **Step 2: Write the course schema**

`schemas/course.schema.json` (envelope only — pages are validated per-type by the JS router):
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "course",
  "type": "object",
  "description": "data/scobot.json envelope. meta/settings read by src/core/course-state.js and src/features/player/player.js; glossary by src/features/glossary/glossary.js; resources by player-nav.",
  "properties": {
    "meta": {
      "type": "object",
      "properties": {
        "title": { "type": "string", "minLength": 1 },
        "description": { "type": "string" },
        "version": { "type": "string" },
        "author": { "type": "string" },
        "scormVersion": { "enum": ["1.2", "2004"] },
        "passingScore": { "type": "number", "minimum": 0, "maximum": 100, "description": "ANSWER-KEY FIELD — drives scaled_passing_score (player.js initScorm)." },
        "masteryScore": { "type": "number", "minimum": 0, "maximum": 100, "description": "ANSWER-KEY FIELD." },
        "maxAttempts": { "type": "number", "minimum": 0 },
        "timeLimit": { "type": "number", "minimum": 0 }
      },
      "required": ["title"]
    },
    "settings": {
      "type": "object",
      "properties": {
        "allowReview": { "type": "boolean" },
        "showFeedback": { "type": "boolean" },
        "shuffleChoices": { "type": "boolean" },
        "forceSequential": { "type": "boolean", "description": "course-state.js canPrev" },
        "showProgress": { "type": "boolean" },
        "requireAnswerToAdvance": { "type": "boolean", "description": "course-state.js canNext" },
        "showResetButton": { "type": "boolean" }
      }
    },
    "pages": { "type": "array", "minItems": 1 },
    "glossary": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": { "term": { "type": "string" }, "definition": { "type": "string" } },
        "required": ["term", "definition"],
        "additionalProperties": false
      }
    },
    "resources": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": { "title": { "type": "string" }, "url": { "type": "string" }, "type": { "type": "string" } },
        "required": ["title", "url"],
        "additionalProperties": false
      }
    }
  },
  "required": ["meta", "pages"]
}
```

- [ ] **Step 3: Append tests (one negative per new type + the real file)**

Append to `tools/validate-course.test.js`:

```javascript
test('the REAL data/scobot.json validates (schemas describe reality)', () => {
  const real = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'data', 'scobot.json');
  const r = validateCourse(real);
  assert.deepEqual(r.errors, []);
});

test('match: pair missing targetText fails with a path', () => {
  const bad = structuredClone(MINIMAL_COURSE);
  bad.pages = [{
    id: 'm1', type: 'match', title: 'M', question: 'Match:',
    pairs: [
      { sourceId: 's1', sourceText: 'A', targetId: 't1', targetText: 'B' },
      { sourceId: 's2', sourceText: 'C', targetId: 't2' }
    ]
  }];
  const r = validateCourse(writeCourse('match-bad.json', bad));
  assert.ok(r.errors.some(e => e.includes('pages[0]') && e.includes('targetText')), r.errors.join('\n'));
});

test('wordpuzzle: blank with empty answers fails', () => {
  const bad = structuredClone(MINIMAL_COURSE);
  bad.pages = [{
    id: 'w1', type: 'wordpuzzle', title: 'W', question: 'Fill:',
    text: 'x {{b1}}', blanks: [{ id: 'b1', answers: [] }]
  }];
  const r = validateCourse(writeCourse('wp-bad.json', bad));
  assert.ok(r.errors.some(e => e.includes('answers')), r.errors.join('\n'));
});

test('duplicate page ids fail', () => {
  const bad = structuredClone(MINIMAL_COURSE);
  bad.pages = [structuredClone(VALID_CHOICE_PAGE), structuredClone(VALID_CHOICE_PAGE)];
  const r = validateCourse(writeCourse('dupe.json', bad));
  assert.ok(r.errors.some(e => e.includes('duplicates')), r.errors.join('\n'));
});

test('course: meta.title is required', () => {
  const bad = structuredClone(MINIMAL_COURSE);
  delete bad.meta.title;
  const r = validateCourse(writeCourse('meta-bad.json', bad));
  assert.ok(r.errors.some(e => e.startsWith('course') && e.includes('title')), r.errors.join('\n'));
});
```

- [ ] **Step 4: Run + fix until green**

Run: `node --test tools/validate-course.test.js` then `npm run validate`
Expected: all tests PASS; `✅ data/scobot.json is valid (5 page types known).`
If the real file fails, the schema is wrong (loosen to describe reality) UNLESS the file has a true defect — in that case STOP and report the defect instead of changing either side silently.

- [ ] **Step 5: Commit**

```bash
git add schemas/ tools/validate-course.test.js
git commit -m "feat(authoring): full schema set — validate green on the live course"
```

---

### Task 3: Answers-to-confirm gate (no-fabrication)

**Files:**
- Modify: `tools/validate-course.js` (replace the `collectAnswerKeys` stub)
- Modify: `tools/validate-course.test.js` (append)

**Interfaces:**
- Produces: `answersToConfirm: string[]` — one human-readable line per answer-key fact, e.g. `q1-web-basics (choice): correct = d "Python"` — consumed by the CLI output (already wired) and the `/new-page` skill (Task 6).

- [ ] **Step 1: Write the failing tests**

Append to `tools/validate-course.test.js`:

```javascript
test('answersToConfirm lists choice keys, match pairs, blanks, weights, passing scores', () => {
  const course = {
    meta: { title: 'T', passingScore: 80 },
    settings: {},
    pages: [
      structuredClone(VALID_CHOICE_PAGE),
      { id: 'm1', type: 'match', title: 'M', question: 'q', weight: 2,
        pairs: [
          { sourceId: 's1', sourceText: 'Shadow DOM', targetId: 't1', targetText: 'Encapsulation' },
          { sourceId: 's2', sourceText: 'ESM', targetId: 't2', targetText: 'Modules' }
        ] },
      { id: 'w1', type: 'wordpuzzle', title: 'W', question: 'q', text: 'x {{b1}}',
        blanks: [{ id: 'b1', answers: ['HTMLElement'] }] }
    ]
  };
  const r = validateCourse(writeCourse('keys.json', course));
  const joined = r.answersToConfirm.join('\n');
  assert.ok(joined.includes('meta.passingScore = 80'));
  assert.ok(joined.includes('q-sample') && joined.includes('"Right"'));
  assert.ok(joined.includes('m1') && joined.includes('Shadow DOM → Encapsulation'));
  assert.ok(joined.includes('w1') && joined.includes('HTMLElement'));
  assert.ok(joined.includes('weight = 2'));
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tools/validate-course.test.js`
Expected: the new test FAILS (answersToConfirm is `[]`).

- [ ] **Step 3: Implement collectAnswerKeys**

Replace the stub in `tools/validate-course.js`:

```javascript
/**
 * The no-fabrication gate (scrybe factsToConfirm, re-aimed at correctness):
 * list every answer-key fact so a HUMAN confirms them — the authoring skill
 * may draft distractors/prose but never silently invents these.
 */
function collectAnswerKeys(course) {
  const out = [];
  const meta = course?.meta || {};
  if (meta.passingScore !== undefined) out.push(`meta.passingScore = ${meta.passingScore}`);
  if (meta.masteryScore !== undefined) out.push(`meta.masteryScore = ${meta.masteryScore}`);

  for (const page of (Array.isArray(course?.pages) ? course.pages : [])) {
    const tag = `${page?.id} (${page?.type})`;
    if (page?.weight !== undefined) out.push(`${tag}: weight = ${page.weight}`);
    if (page?.type === 'choice' && Array.isArray(page.choices)) {
      const correct = page.choices.filter(c => c?.correct).map(c => `${c.id} "${c.text}"`);
      out.push(`${tag}: correct = ${correct.join(', ') || '(none marked!)'}`);
    }
    if (page?.type === 'match' && Array.isArray(page.pairs)) {
      page.pairs.forEach(p => out.push(`${tag}: ${p.sourceText} → ${p.targetText}`));
    }
    if (page?.type === 'wordpuzzle' && Array.isArray(page.blanks)) {
      page.blanks.forEach(b => out.push(`${tag}: {{${b.id}}} = ${(b.answers || []).join(' | ')}`));
    }
  }
  return out;
}
```

- [ ] **Step 4: Verify GREEN + real-course output**

Run: `node --test tools/validate-course.test.js` (all PASS) then `npm run validate`
Expected: valid, plus a `🔑 Answers to confirm` section listing the live course's keys (5 pages' worth).

- [ ] **Step 5: Commit**

```bash
git add tools/validate-course.js tools/validate-course.test.js
git commit -m "feat(authoring): answers-to-confirm gate — answer keys are human-confirmed facts"
```

---

### Task 4: Package-time enforcement

**Files:**
- Modify: `tools/create-scorm-package.js` (after the dist-exists check, ~line 28, BEFORE "Load course data")

**Interfaces:**
- Consumes: `validateCourse(filePath)` from `tools/validate-course.js`.

- [ ] **Step 1: Wire the gate**

In `tools/create-scorm-package.js`, add to the imports:
```javascript
import { validateCourse } from './validate-course.js';
```
and insert after the dist-exists check (before `// Load course data`):
```javascript
// Schema gate: an invalid course must never become an LMS package.
const validation = validateCourse('./data/scobot.json');
if (!validation.valid) {
  console.error('❌ data/scobot.json failed schema validation — refusing to package.');
  validation.errors.forEach(e => console.error(` - ${e}`));
  console.error('   Fix the errors (see `npm run validate`) and re-run.');
  process.exit(1);
}
console.log('✅ Course schema validation passed');
```

- [ ] **Step 2: Verify both directions**

```bash
npm run scorm            # expected: "✅ Course schema validation passed" + zip builds
node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('data/scobot.json'));d.pages[1].type='essay';fs.writeFileSync('/tmp/claude-501/bad-course.json',JSON.stringify(d))"
node tools/validate-course.js /tmp/claude-501/bad-course.json   # expected: exit 1, names allowed types
git diff --exit-code data/scobot.json                            # expected: real file untouched
```
Then corrupt the REAL file transiently to prove the packager refuses: `git stash`-free approach — edit `data/scobot.json` pages[1].type to `"essay"`, run `npm run scorm` (expected: refuses, exit 1), then `git checkout -- data/scobot.json`.

- [ ] **Step 3: Verify the zip never contains schemas/examples**

```bash
unzip -l scorm-packages/*_scorm2004.zip | /usr/bin/grep -c "schemas/\|examples/" || echo "clean"
```
Expected: `clean` (grep finds nothing).

- [ ] **Step 4: Commit**

```bash
git add tools/create-scorm-package.js
git commit -m "feat(authoring): create-scorm-package refuses to zip a schema-invalid course"
```

---

### Task 5: Golden examples

**Files:**
- Create: `examples/title-page.json`, `examples/choice.json`, `examples/match.json`, `examples/wordpuzzle.json`, `examples/scorecard.json`, `examples/course.json`
- Modify: `tools/validate-course.test.js` (append)

**Interfaces:**
- Produces: one canonical page per type (agents imitate these — scrybe spec §10); `examples/course.json` = minimal full file. Consumed by the `/new-page` skill (Task 6).

- [ ] **Step 1: Write the examples**

Each page example is the corresponding page from `data/scobot.json`, copied verbatim (they are known-good and voice-correct): `welcome` → `examples/title-page.json`; `q2-web-components` (the multiSelect one, id `q2-components`) → `examples/choice.json`; `match1-terms` → `examples/match.json`; `puzzle1-code` → `examples/wordpuzzle.json`; `results` → `examples/scorecard.json`. Extract them with node (do not hand-retype):

```bash
node -e "
const fs=require('fs');
const d=JSON.parse(fs.readFileSync('data/scobot.json'));
const picks={'title-page':'welcome','choice':'q2-components','match':'match1-terms','wordpuzzle':'puzzle1-code','scorecard':'results'};
fs.mkdirSync('examples',{recursive:true});
for(const [type,id] of Object.entries(picks)){
  const page=d.pages.find(p=>p.id===id);
  fs.writeFileSync('examples/'+type+'.json',JSON.stringify(page,null,2)+'\n');
}
const mini={meta:{title:'Example Course',passingScore:80},settings:{requireAnswerToAdvance:true,forceSequential:true},
  pages:[d.pages.find(p=>p.id==='welcome'),d.pages.find(p=>p.id==='q1-web-basics'),d.pages.find(p=>p.id==='results')],
  glossary:[d.glossary[0]],resources:[d.resources[0]]};
fs.writeFileSync('examples/course.json',JSON.stringify(mini,null,2)+'\n');
console.log('examples written');
"
```

- [ ] **Step 2: Test that every example stays valid forever**

Append to `tools/validate-course.test.js`:

```javascript
test('every golden example page validates under its schema; examples/course.json validates whole', () => {
  const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
  for (const type of PAGE_TYPES) {
    const page = JSON.parse(fs.readFileSync(path.join(root, 'examples', `${type}.json`), 'utf8'));
    const course = { meta: { title: 'X' }, settings: {}, pages: [page] };
    const r = validateCourse(writeCourse(`example-${type}.json`, course));
    assert.deepEqual(r.errors, [], `${type} example invalid`);
  }
  const r = validateCourse(path.join(root, 'examples', 'course.json'));
  assert.deepEqual(r.errors, []);
});
```

- [ ] **Step 3: Run, verify PASS, commit**

Run: `node --test tools/validate-course.test.js` — all PASS.

```bash
git add examples/ tools/validate-course.test.js
git commit -m "feat(authoring): golden examples per template type (extracted from the live course)"
```

---

### Task 6: The /new-page skill + MANIFEST registration

**Files:**
- Create: `.claude/skills/new-page/SKILL.md`
- Modify: `MANIFEST.toml` (append capability; bump `updated`)

- [ ] **Step 1: Write the skill**

Create `.claude/skills/new-page/SKILL.md`:

```markdown
---
name: new-page
description: Author a new course page for this SCORM player by conversation — describe the page (a quiz question, a matching exercise, a fill-in-the-blank, a cover page) and this skill drafts a schema-valid entry in data/scobot.json, validates it, and presents the answer key for human confirmation. Use when asked to add a page, question, quiz item, or interaction to the course.
---

# New Course Page (scrybe pattern)

You produce **data, not code**: a page object appended to `data/scobot.json`,
rendered by an EXISTING template. Never invent new `type` values (that is
Tier 2 — a different skill). Never touch `src/`.

## Flow

1. **Classify.** From the owner's description, pick the template type:
   `title-page` (informational/cover), `choice` (single or multiSelect question),
   `match` (pair matching), `wordpuzzle` (fill-in-the-blanks), `scorecard`
   (results — courses normally have exactly one, last). Ask ONE question if
   genuinely ambiguous; otherwise proceed.
2. **Imitate the golden example.** Read `examples/<type>.json` and
   `schemas/<type>.schema.json` — the example is the voice and shape to copy.
   Field meanings are in the schema `description`s (each names the component
   that consumes it).
3. **Draft.** Kebab-case `id`, unique across `pages[]`. You MAY draft the
   question, distractors, feedback text, and pair/blank candidates. You may
   PROPOSE an answer key — but it is a proposal until step 5.
4. **Validate.** Append the page to `data/scobot.json` (position: before the
   scorecard unless told otherwise), run `npm run validate`, and fix schema
   errors yourself in the same turn until green.
5. **THE GATE — answers to confirm.** Show the owner the validator's
   `🔑 Answers to confirm` lines for the NEW page (correct choices / pairs /
   blank answers / weight, plus any passingScore impact). The page is not
   done until the owner confirms the key is correct. Never skip; never bury
   it mid-paragraph.
6. **Preview.** `npm run build`, then `npx serve dist` and give the owner the
   URL. SCORM wiring is automatic: the page `id` becomes the interaction and
   objective id, and interactive pages are counted into `setTotals` at
   runtime — no tracking work per page.
7. **Ship gate stays human.** Never commit or package without an explicit go.

## Tripwires

- Schema-invalid output you can't fix in two attempts → show the errors, ask.
- The owner's description implies a NEW interaction style → say it needs a
  new template (Tier 2), do not shoehorn it into `choice`.
- `npm run validate` must be green before you ever say "done".
```

- [ ] **Step 2: Register in MANIFEST.toml**

Append (and bump `[project] updated` to today's date):

```toml
[[capabilities]]
id = "conversational-page-authoring"
tags = ["elearning", "testing", "schemas", "authoring", "scorm"]
claim = "Scrybe-pattern authoring for the SCORM player (branch scobot-player2): JSON Schema per template type (schemas/), Ajv validator with answers-to-confirm no-fabrication gate (tools/validate-course.js, npm run validate), golden examples (examples/), package-time enforcement in create-scorm-package, and a /new-page conversational skill. Lean port of scrybe's authoring layer — data generation only, no code-gen (that is Tier 2)."
maturity = "working"
entry_points = ["schemas/", "tools/validate-course.js", "examples/", ".claude/skills/new-page/SKILL.md"]
pattern_doc = "../scrybe/SCRYBE.md"
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/new-page/ MANIFEST.toml
git commit -m "feat(authoring): /new-page conversational skill + fleet registry capability"
```

---

### Task 7: Dogfood acceptance run

**Files:** touches `data/scobot.json` transiently (restored) — no permanent source changes.

- [ ] **Step 1: Author a page following the skill**

Follow `.claude/skills/new-page/SKILL.md` literally with this brief: *"Add a single-answer quiz page after q3-scorm asking which SCOBot method finalizes scoring — correct answer gradeIt, distractors happyEnding, updateStatus, finish. Weight 1."* Draft the page (id `q4-gradeit`), append to `data/scobot.json` before the scorecard, run `npm run validate` until green.

- [ ] **Step 2: Confirm the gate output**

`npm run validate` must list under `🔑 Answers to confirm`: `q4-gradeit (choice): correct = <id> "gradeIt"` and `weight = 1`. Record the exact lines in the task report — this stands in for owner confirmation in the acceptance run.

- [ ] **Step 3: Verify the page tracks in the mock LMS**

```bash
npm run build && npx serve dist -l 4180 &
```
Drive Chrome (claude-in-chrome tools, ONE ToolSearch batch; javascript_tool + console for assertions; avoid confirm()-triggering controls): navigate to the player, advance to `q4-gradeit`, answer "gradeIt", then assert the mock store (`localStorage.SCOBot_Mock_Data`) contains an interaction AND objective with id `q4-gradeit`, result `correct`. Kill the serve process.

- [ ] **Step 4: Verify packaging + restore**

```bash
npm run scorm          # expected: validation passed + zip builds WITH the new page
git checkout -- data/scobot.json   # restore — the demo page does not ship in the repo
npm run build          # rebuild dist back to the committed course
```

- [ ] **Step 5: Final full test pass + commit (tests only — no content changes)**

Run: `npm run test:tools`
Expected: minify (13) + validate-course suites all PASS.

```bash
git status --short     # expected: clean
git commit --allow-empty -m "test(authoring): dogfood acceptance — /new-page flow authored, validated, tracked in mock LMS, packaged"
```

---

## Post-plan follow-ups (not tasks)

- Tier 2 spec: `/new-type` (schema + Web Component + registry entry generation with build-guard + mock-LMS verification loop) — completes scrybe's own roadmap item in a second domain.
- If a third scrybe-pattern consumer appears, factor `@cybercussion/scrybe-core`.
- Optional: `npm run validate` inside `npm run build` (kept separate for now — build speed).
