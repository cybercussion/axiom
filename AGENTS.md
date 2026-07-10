# Agent Guide — SCOBot Player 2 (axiom, branch scobot-player2)

Orientation for ANY coding agent working in this repo. (Claude Code users
also get `.claude/skills/` routers for the workflows below — same contracts,
auto-triggered.)

## What this is

The SCORM-package lane of the Axiom zero-build vanilla-JS framework: a SCO
course player (template Web Components driven by `data/scobot.json`) with
[@cybercussion/scobot](https://www.npmjs.com/package/@cybercussion/scobot)
handling the SCORM 1.2/2004 runtime. See `README.md` (framework +
branch overview) and `SCOBot_README.md` (SCORM integration guide).

## Contracts — read before the matching task

- **Adding course content** (pages, questions, interactions):
  read **`AUTHORING.md`** — schema-validated JSON authoring with a
  human-confirmed answer-key gate. Never hand-edit `data/scobot.json`
  without running its flow.
- **Build/deploy/caching**: `docs/patterns/stale-deploy-prevention.md` —
  the fleet's cache-busting contract. `tools/minify.js` runs
  `BUILD_PROFILE='scorm'` on this branch (relative paths, live import map);
  never mix it with the website lane's absolute-path profile.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | live-reload dev server |
| `npm run build` | src → dist (minify + stamp + 3 hard-fail guards) |
| `npm run validate` | course JSON schema gate + 🔑 answer-key report |
| `npm run test:tools` | node --test suite for the build/validation tooling |
| `npm run scorm[:12\|:2004]` | validated SCORM zip → `scorm-packages/` |

## Ecosystem

- **[SCOBot Packager](https://cybercussion.com/scobot/packager)** — Rust
  multi-platform packager + LMS previewer (test content against real SCORM
  Runtime APIs locally).
- **[scobot.cybercussion.com](https://scobot.cybercussion.com)** — our LMS
  for real-runtime verification and hosting.
- **[SCOBot wiki](https://github.com/cybercussion/SCOBot/wiki)** — SCORM
  documentation and LMS troubleshooting lore.

## Ground rules

1. `dist/` is generated — edit `src/`, never dist.
2. Values written to SCORM are strings; the Content API owns CMI access
   (raw `setvalue` only where `SCOBot_README.md` documents the escape hatch).
3. Answer keys, weights, and passing scores are human-confirmed facts —
   agents draft, owners confirm (`AUTHORING.md` gate).
4. Run `npm run test:tools` after touching anything under `tools/`.
