# Authoring Course Content — the Contract

This is the runtime-neutral contract for adding pages to this SCORM player's
course (`data/scobot.json`). It works with **any** coding agent (Claude Code,
Codex, Cursor, Gemini CLI, aider, …) or by hand — the enforcement layer is
plain files and npm scripts, no MCP or vendor tooling required. Claude Code
users can invoke it as the `/new-page` skill (a thin router to this file).

**You produce data, not code.** A page is a JSON object rendered by an
EXISTING template. Never invent new `type` values (new interaction components
are a separate, code-generating workflow). Never touch `src/`.

## The building blocks

| Piece | Purpose |
|---|---|
| `schemas/<type>.schema.json` | The contract per template type — every field's `description` names the component that consumes it |
| `examples/<type>.json` | Golden example per type, extracted from the live course — **imitate these**, don't improvise shapes |
| `npm run validate` | The referee: Ajv field-level errors + the 🔑 answers-to-confirm report |
| `npm run scorm[:12\|:2004]` | Packaging — refuses schema-invalid courses outright |

Page types: `title-page` (informational/cover, auto-completes), `choice`
(single or multi-select question), `match` (pair matching), `wordpuzzle`
(fill-in-the-blanks), `scorecard` (results — exactly one, last).

## The flow

1. **Classify.** From the description, pick the template type. Ask ONE
   question if genuinely ambiguous; otherwise proceed.
2. **Imitate the golden example.** Read `examples/<type>.json` and
   `schemas/<type>.schema.json`. The example is the voice and shape to copy.
3. **Draft.** Kebab-case `id`, unique across `pages[]`. You MAY draft the
   question, distractors, feedback text, and pair/blank candidates. You may
   PROPOSE an answer key — but it is a proposal until step 5.
4. **Validate.** Append the page to `data/scobot.json` (position: before the
   scorecard unless told otherwise), run `npm run validate`, and fix schema
   errors yourself in the same turn until green. Typos in field names FAIL
   validation (unevaluatedProperties) — trust the error, it names the key.
5. **THE GATE — answers to confirm.** Show the owner the validator's
   `🔑 Answers to confirm` lines for the NEW page (correct choices / pairs /
   blank answers / weight, plus any passingScore impact). The page is not
   done until the owner confirms the key is correct. Never skip; never bury
   it mid-paragraph. **Never silently invent an answer key** — that is the
   one unforgivable fabrication in this workflow.
6. **Preview.** `npm run build`, then `npx serve dist` and give the owner the
   URL. SCORM wiring is automatic: the page `id` becomes the interaction and
   objective id, and interactive pages are counted into `setTotals` at
   runtime — no tracking work per page.
7. **Ship gate stays human.** Never commit or package without an explicit go.

## Tripwires

- Schema-invalid output you can't fix in two attempts → show the errors, ask.
- The description implies a NEW interaction style → say it needs a new
  template type; do not shoehorn it into `choice`.
- `npm run validate` must be green before you ever say "done".

## Packaging, previewing, hosting

- `npm run scorm` builds a SCORM 2004 zip (`scorm:12` for 1.2) — validation
  gated, output in `scorm-packages/`.
- **[SCOBot Packager](https://cybercussion.com/scobot/packager)** — Rust-based
  multi-platform (macOS/Linux/Windows) content packager and **LMS previewer**:
  bundle and test your content against real SCORM Runtime APIs locally.
- **[scobot.cybercussion.com](https://scobot.cybercussion.com)** — our LMS:
  upload the zip and verify tracking (bookmark/resume, interactions,
  objectives, score/completion) against a real runtime.
- The SCORM integration itself is documented in
  [SCOBot_README.md](SCOBot_README.md) (the
  [@cybercussion/scobot](https://www.npmjs.com/package/@cybercussion/scobot)
  Content API).
