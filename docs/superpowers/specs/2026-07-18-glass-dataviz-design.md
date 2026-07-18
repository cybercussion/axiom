# Glass Data-Viz Component Set — Design

**Date:** 2026-07-18
**Status:** Approved (Approach A — HTML/CSS marks + SVG arcs, dumb components)
**Scope:** Base Axiom (fleet upstream), on `main` (motion-system merged). Reference: the
visionOS-style "Lifestats" glass dashboard composition.
**Intent:** These components are fleet primitives — the beginning of a house "OS UI" that
replaces vanilla/browser chart & progress rendering across Cybercussion projects.

## Goal

Extend the `ax-*` family with glassmorphism data-viz primitives: pill bar chart, segmented
donut ring, circular progress gauge, stat tile, trend delta, status chip, and a week date
strip — plus a two-level glass surface system. Rebuild `/dashboard` as the flagship
composition and document each component on `/components`.

## Non-goals

- No chart library, no dependencies, no build step (house rules stand).
- No general-purpose charting engine (line/area/scatter etc.) — only the forms above. More
  forms come later passes; the dataviz method (form → color job → validate) governs them
  when they do.
- No real data sources — `/dashboard` runs on the extended mock in `dashboard-api.js`.
- No dual-axis anything, ever (dataviz non-negotiable).

## Method constraints (from the dataviz skill — binding)

- **Color is computed, not eyeballed.** The chart palette must pass
  `validate_palette.js` (six checks) against BOTH theme surfaces (light + dark) before the
  tokens are frozen. Adjacent-pair CVD ΔE ≥ 8 target; normal-vision floor ≥ 15 hard.
- **Categorical hues assigned in fixed order, never cycled**; color follows the entity.
- **Text wears text tokens, never series color** — values/labels/legends in
  foreground/muted ink; a colored mark beside them carries identity.
- **Status tones are reserved** (existing `--success/warning/danger` + chip tones) and
  ship with icon or label, never color alone.
- **Marks:** rounded data-ends anchored to the baseline; 2px surface gaps between adjacent
  bars and between donut segments; recessive rails (reuse `--control-track`).
- **Hover layer ships by default** on bar and ring marks (tooltip; hit target ≥ mark).
  Stat tiles are the sanctioned "not a chart" form — no hover layer.
- **Non-color access:** every chart carries an sr-only textual data summary; rings with
  ≥ 2 segments render a legend; single-series forms don't get a legend box.

## 1. Glass surface layer + chart tokens (`theme.css`)

Two-level glass system, both themes:

```css
/* dark */
--glass-panel: rgba(18, 18, 24, 0.55);        /* outer sheet; pairs with blur(24px) */
--glass-panel-border: rgba(255, 255, 255, 0.12);
--glass-tile: rgba(255, 255, 255, 0.06);      /* nested inner tile */
--glass-tile-border: rgba(255, 255, 255, 0.08);
/* light */
--glass-panel: rgba(255, 255, 255, 0.55);
--glass-panel-border: rgba(0, 0, 0, 0.08);
--glass-tile: rgba(255, 255, 255, 0.55);
--glass-tile-border: rgba(0, 0, 0, 0.06);
```

Existing `.glass-card` maps onto `--glass-panel`; new components sit on `--glass-tile`.
Utility classes `.glass-panel` / `.glass-tile` added for feature layouts.

Chart tokens (candidate values — **final values are whatever passes the validator**, snapped
per mode if needed):

```css
--chart-1: #3b82f6;  /* axiom blue — anchor */
--chart-2: #eab308;  /* yellow (reference's calories arc) */
--chart-3: #10b981;  /* green */
--chart-4: #ec4899;  /* pink */
```

Validation gate: `node <dataviz-skill>/scripts/validate_palette.js "<hex,...>" --mode light`
and `--mode dark` with the corresponding `--color-bg` surface; both must PASS (a contrast
WARN is acceptable only because every mark carries a visible text label or sr-only summary
per the method; CVD/normal-vision FAILs are not).

## 2. Components — `src/shared/controls/`

House contract (identical to the motion-pass controls): BaseComponent subclass, single
file, inline `addStyles` CSS consuming only tokens, dumb (data in via property/attributes,
events out `bubbles+composed`, never imports `@state`), `_esc()` on interpolated text,
motion tokens only (reduced-motion collapse inherited), listeners that must attach once go
in the constructor, `attributeChangedCallback` guards for pre-render calls.

| Tag | API | Behavior & motion |
|---|---|---|
| `ax-barchart` | `data` property `[{label, value}]` (also accepts JSON in a `data` attr); attrs `max` (default: data max), `unit`, `label` | Grid of rounded pill columns on `--control-track` rails; bars grow from baseline with `--ease-spring`, staggered ~40ms like `setAll`; selective inline value labels (explicit rule: bars ≥ 60% of max, plus first and last bar; text tokens); per-bar hover/focus tooltip `«label: value unit»`; sr-only list of all values; bars are focusable for keyboard tooltip access |
| `ax-ring` | `segments` property `[{label, value}]` (2–4 segments); attrs `size` (px, default 160), `label`; default slot = center content | SVG donut: segments in fixed `--chart-N` order, `stroke-linecap: round`, 2px gaps; arcs sweep in sequentially on mount/data change (`--ease-cinematic`, `--duration-slow`); built-in dot legend in a `legend` named-slot position defaulting BELOW the arc (dot = series color, text = text tokens); consumers may slot their own legend rows instead (the dashboard overview does, to include ax-trend deltas); per-segment hover tooltip + sr-only summary; role="img" with aria-label |
| `ax-progress-ring` | attrs `value` (0–100, clamped, NaN→0), `size` (default 44), `label` | Single arc over `--control-track` rail; sweeps on value change (tween, never jumps — same contract as ax-progress); at 100 shows a check mark (drawn stroke animation); ARIA progressbar via ElementInternals |
| `ax-stat` | attrs `value`, `label`, `unit`; named slots `icon`, `trend` | Glass tile (`--glass-tile`), icon chip at left, big value + muted label; value changes cross-fade; no hover layer (stat-tile form) |
| `ax-trend` | attrs `value` (signed number, e.g. `-3.54`), `good` (boolean: down is good, e.g. weight loss) | Arrow glyph + `±N.NN%`; tone = success/danger from sign × `good` flip; icon + sign mean it is never color-alone; animated flip on sign change |
| `ax-chip` | attr `tone` (`ongoing` \| `complete` \| `neutral`), default slot label | Pill badge; `complete` = success tone + check glyph, `ongoing` = primary tone, `neutral` = muted; tone changes cross-fade (`--duration-fast`); never color-alone (glyph/label carries state) |
| `ax-datestrip` | attrs `date` (ISO anchor, default today), `selected` (ISO); emits `change` `detail: { date }` (ISO string); prev/next buttons shift the week | Seven day/date columns; selected-day pill glides between columns (dock-pill pattern, `--ease-spring`); prev/next are 44px targets; keyboard: arrow keys move selection, buttons tab-reachable; aria-pressed/current semantics |

Charts accept data BOTH as a JS property (primary, for feature code) and as a JSON
attribute (for static/showcase markup); property wins. Invalid/empty data renders an empty
rail state, never throws.

## 3. Flagship: `/dashboard` rebuild

`dashboard-api.js` mock extended to a Lifestats-shaped payload (weekly activity values,
overview segments + center %, three stat tiles w/ trends, challenges list with
progress/percent/state, current week). `dashboard.js` recomposed with the reference's
structure: activity panel (ax-barchart), overview panel (ax-ring + ax-trend legend rows),
stat column (ax-stat × 3), challenges rows (ax-progress-ring + label + fraction + ax-chip),
ax-datestrip panel. All inside `.glass-panel` sections with `.glass-tile` nesting. Existing
route wiring (`api` / `dataKey: 'dashboardData'`) unchanged. The old System Controls /
Configuration demo content is replaced.

`/components` gains one reference section per new component with a usage snippet, wired
live (barchart randomize button, ring re-segment, progress-ring slider, chip tone toggle,
datestrip event log line).

## 4. Error handling / edge cases

- All numeric attrs clamped/NaN-guarded (ax-progress conventions).
- ax-ring with < 2 segments: renders single arc, suppresses legend box (single-series
  rule); > 4 segments: first 3 + "Other" fold (fixed-order rule, no hue cycling).
- ax-datestrip month boundaries handled via Date arithmetic (no libraries); emits ISO
  `YYYY-MM-DD` strings only.
- Tooltips clamp to component bounds (no viewport escape needed at tile sizes).
- `prefers-reduced-motion` / `[data-motion="reduced"]`: sweeps/staggers collapse via the
  token system (inherited — no per-component work beyond consuming tokens).

## 5. Testing / verification

- **Palette gate:** validator PASS both modes, output captured in the task report.
- Browser walkthrough: dashboard composition light+dark, bar stagger + ring sweep on
  entry, tooltips (mouse + keyboard focus), datestrip pill glide + change events,
  reduced-motion collapse, /components sections live.
- Anti-patterns checklist (`references/anti-patterns.md`) pass over the dashboard.
- Motion grep gates stay clean; `node tools/minify.js` + `npm run test:tools` pass.
- Form-participation N/A (these are display components; datestrip emits events only).

## 6. Fleet propagation

Record `glass-dataviz-set` capability in MANIFEST.toml (entry_points: theme.css tokens,
`src/shared/controls/`, dashboard feature, this spec). Same borrow-don't-fork policy as
the motion system. Downstream note: components require the motion tokens + `--control-track`
(motion-system capability) — sync `src/shared/` wholesale, not files piecemeal.
