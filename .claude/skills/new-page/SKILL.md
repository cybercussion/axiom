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
