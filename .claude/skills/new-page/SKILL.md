---
name: new-page
description: Author a new course page for this SCORM player by conversation — describe the page (a quiz question, a matching exercise, a fill-in-the-blank, a cover page) and this skill drafts a schema-valid entry in data/scobot.json, validates it, and presents the answer key for human confirmation. Use when asked to add a page, question, quiz item, or interaction to the course.
---

# New Course Page — router

Read **`AUTHORING.md`** at the repo root and follow it exactly. It is the
canonical, runtime-neutral contract (this skill is only the Claude Code
entry point — the same contract serves agents discovering it via AGENTS.md).

Non-negotiables you are about to encounter there: imitate the golden example
in `examples/<type>.json`; `npm run validate` green before "done"; the
🔑 answers-to-confirm gate is shown to the owner and confirmed — never skip,
never bury it, never silently invent an answer key; no new `type` values;
the ship gate stays human.
