# Cyber-Neumorphism Surface Tier — Design

**Date:** 2026-07-20
**Status:** Approved scope (all four slices + knob from reference 2)
**Scope:** Base Axiom, on `main`. References: (1) neumorphic power/battery panel — extruded
charcoal, inset wells, glowing gauge, tick ruler, chevron stepper, ON key, LEDs;
(2) neumorphic music-player set — LIGHT + DARK variants, cyan/magenta aurora underglow,
rotary dial, round raised buttons, inset groove progress; (3) user direction: switches
that look physically real (slide-puck and rocker archetypes from the CSS-neumorphism
genre — freefrontend gallery, bot-walled so techniques cited from the genre's canon).
**Intent:** A second surface tier beside glass: `glass` = translucency + blur (airy
dashboards), `neu` = opacity + depth (instrument panels). One design language, two
materials; all existing motion/token/a11y rules apply unchanged.

## Hard constraints (user-set)

- **Simplicity is non-negotiable**: vanilla ES6 + home-grown CSS only; the whole tier is
  tokens, utility classes, `:host([surface="neu"])` CSS variants, and four small
  primitives following the existing single-file pattern. If a piece needs a library or a
  build step, it's out.
- **No bloat**: variants are additive CSS on existing controls (no forked components, no
  new base classes); the four primitives reuse established patterns (progress-ring arc
  math, slider event contract, chip tone mapping).
- **Agent-uniform API**: every control keeps the same contract shape (attrs in, composed
  events with `detail` out, property-wins data, `surface`/`variant` attrs for skinning) so
  coding agents can compose UIs without reading internals. Deliverable:
  **`docs/CONTROLS.md`** — a one-page agent-facing reference listing every `ax-*` tag, its
  attributes, properties, events, slots, and variants (the SCOBOT.md precedent). Kept
  current as part of this pass; MANIFEST points at it.

## Non-goals

- No forked components — neumorphism arrives as tokens, utilities, `surface="neu"`
  variants on existing controls, and four new primitives. Same files, same contracts.
- No new fonts (display numerals approximate the reference with `--font-mono`, heavy
  weight, wide tracking). No dependencies. No literal durations/easings (gate enforces).
- The cyan aurora accent is DECORATIVE ONLY — glows and shadows, never text ink, never a
  data-mark color (dataviz palette rules untouched; `--chart-*` unchanged, no validator
  run needed because no categorical mark color changes).

## 1. Depth tokens + surface utilities (`theme.css`)

New token block (both themes; recipes shared, materials differ):

```css
/* dark */
--neu-surface: #1c1e26;        /* raised panel base — blue-tinted charcoal */
--neu-surface-deep: #14161c;   /* recessed/base background behind panels */
--neu-light: rgba(255, 255, 255, 0.06);
--neu-dark: rgba(0, 0, 0, 0.62);
--accent-glow: #38bdf8;        /* cyan aurora — decorative only (shadows/glows) */

/* light */
--neu-surface: #e6e9f0;
--neu-surface-deep: #d9dde6;
--neu-light: rgba(255, 255, 255, 0.92);
--neu-dark: rgba(163, 177, 198, 0.55);
/* --accent-glow unchanged */
```

Composite shadows (defined once, from the pieces above):

```css
/* Face gradients — the premium trick from the reference pen (WNvqjpL):
   raised elements carry a subtle top-lit vertical gradient, never a flat
   fill; pressed states swap to the well shadows + a reversed face. */
--neu-face: linear-gradient(180deg,
    color-mix(in srgb, var(--neu-surface) 88%, white) 0%, var(--neu-surface) 100%);
--neu-face-pressed: linear-gradient(180deg,
    color-mix(in srgb, var(--neu-surface) 90%, black) 0%, var(--neu-surface) 100%);
--neu-raised: -6px -6px 14px var(--neu-light), 6px 6px 16px var(--neu-dark);
--neu-raised-sm: -3px -3px 7px var(--neu-light), 3px 3px 8px var(--neu-dark);
--neu-well: inset 4px 4px 10px var(--neu-dark), inset -4px -4px 8px var(--neu-light);
--neu-glow: 0 0 24px color-mix(in srgb, var(--accent-glow) 40%, transparent);
```

Utilities: `.neu-panel` (raised, `--neu-surface`, radius 24px), `.neu-well` (inset,
`--neu-surface-deep`, radius 16px), `.neu-glow` (adds the aurora shadow — composable with
either). Pressed affordance is a shared rule: `.neu-raised:active`-style swap from raised
to well shadows with a token-driven transition.

## 2. New primitives (`src/shared/controls/`, house contract throughout)

House contract = BaseComponent subclass, memoized `addStyles`, dumb (props/attrs in,
composed events out), motion tokens only, `_esc()`, constructor listeners,
`attributeChangedCallback` guards, ElementInternals ARIA, sr-only where data-bearing,
44px targets, JS timers via `motionMs()`.

| Tag | API | Behavior |
|---|---|---|
| `ax-gauge` | attrs `value` (0–100 clamp; ABSENT → 0 with `data-empty` set — a gauge has no indeterminate state, unlike ax-progress), `max` (default 100), `unit`, `label`, `ticks` (default 6) | Vertical inset well (`--neu-well`) with rounded glowing fill (aurora: primary→accent-glow gradient + blur halo); height-based fill (width lesson: never scale), tweens on change; tick ruler with labels rendered left (text tokens, `--text-xs` mono); ElementInternals `role="meter"` + valuenow/min/max; sr-only value summary |
| `ax-stepper` | attrs `value`, `min`, `max`, `step` (default 1), `label`, `orientation` (`vertical` default, `horizontal`); property `value`; emits `change` (`detail: { value }`) per activation | Two chevron keys in a raised pill (`--neu-raised-sm`, pressed = well swap); 44px targets; hold-to-repeat (plain constants: 400ms initial delay, 120ms repeat — interaction cadence, NOT a transition wait, so it deliberately does not use `motionMs`/tokens and must not collapse under reduced motion); keyboard Up/Down (Left/Right when horizontal); ElementInternals `role="spinbutton"` + valuenow/min/max; clamps at bounds and disables the exhausted key visually + aria-disabled |
| `ax-led` | attrs `tone` (`ok`\|`info`\|`warn`\|`danger`\|`off`, default `off`), `pulse` (boolean), `label` (required for non-decorative use; absent → `aria-hidden`) | 8px dot; tone colors from existing status tokens + `--accent-glow` for `info`; glow halo; `pulse` = breathing opacity loop (infinite ambient → `motion-gate: allow`); tone cross-fades |
| `ax-knob` | attrs `value`, `min` (0), `max` (100), `step` (1), `size` (default 96), `label`; property `value`; emits `input` (during drag) / `change` (on release), `detail: { value }` (number); formAssociated | Raised circle (`--neu-raised`) with indicator dot + glowing arc (SVG, progress-ring math) around the rim; interaction = **vertical drag** (pointer capture; up increases — synth-plugin convention, no circular-tracking ambiguity), wheel optional NO (scroll hijack), keyboard arrows/Home/End; ARIA `role="slider"` via internals; `touch-action: none` on the knob; drag is pointer-captured so it keeps tracking outside the element |

## 3. `surface="neu"` variants (existing controls, additive CSS + no contract changes)

- `ax-button surface="neu"` (+ optional `shape="round"`): raised key on `--neu-surface`,
  `:active` swaps to well (the pressed-in ON-key feel), tone colors move to the label/icon
  ink instead of the surface; loading/aria contracts unchanged.
- `ax-toggle surface="neu"` — **realistic slide switch**: the track becomes a deep inset
  groove (`--neu-well`, taller than the glass variant: 28×48px thumb travel area), the
  thumb a raised convex puck (`--neu-raised-sm` + a subtle radial highlight so it reads
  domed, not flat) that travels with `--ease-spring`; checked adds an `--accent-glow` halo
  to the puck and a small glowing indicator sliver in the groove. Pressed (`:active`)
  flattens the puck shadow one step (physical push-down).
- `ax-dipswitch surface="neu"` — **realistic rocker bank**: the bank becomes a recessed
  well; each switch is a rocker CAP that TILTS on a pivot (CSS `perspective` +
  `rotateX(±14deg)` on a two-faced cap, upper/lower faces shaded by `--neu-light`/
  `--neu-dark` so the tilted face catches light), springing between states with
  `--ease-spring`; the ON position exposes a small `--accent-glow` dot at the cap's top
  edge. Composes with the existing ax-toggle internals — the rocker look is CSS on the
  dipswitch's slotted toggles via `::part`/host-context styling, with the toggle's neu
  variant providing the cap faces (`surface` attribute forwarded by the dipswitch to its
  internal toggles).
- `ax-slider surface="neu"` (composes with `variant="fill"`): rail becomes an inset groove
  (`--neu-well`), fill uses the aurora gradient with a subtle glow; knobbed variant gets a
  raised puck thumb.
- `ax-progress surface="neu"`: inset groove + glowing fill (the reference's played-portion
  sliver).
- Variants are pure CSS keyed off `:host([surface="neu"])` — no JS changes, no observed
  attribute (construction-time surface choice, same boundary as `size`).

## 4. Showcase: "Power panel" + knob row (`/components`)

New section recreating reference 1 inside a `.neu-panel` on `--neu-surface-deep`
background strip: vertical POWER label (rotated, letter-spaced mono), `ax-gauge` with
ticks at left driven by an `ax-stepper` labeled CAPACITY, display numerals (`ax-stat`
pattern with mono-heavy styling) showing the gauge value + `%`, an LED rail (three
`ax-led` tones incl. one `pulse`), a round `surface="neu"` icon-button column, and an ON
`ax-button surface="neu"`. Beside it: an `ax-knob` demo (volume) wired to an
`ax-led`-annotated readout, shown against both a `.neu-panel` and the page's glass card so
the tier mixing is visible. Both themes must read correctly (light neumorphism per
reference 2).

## 5. Edge cases / a11y

- All numeric attrs clamped, NaN-guarded; stepper/knob respect min/max exactly at bounds.
- Knob drag: pointer capture, Escape cancels drag restoring the pre-drag value, `change`
  only fires if the value actually differed (same-value no-op rule).
- LED without a `label` is `aria-hidden` (decoration); with one it's `role="status"`.
- Contrast: neu surfaces are LOW-CONTRAST by nature — all text on neu surfaces uses
  `--color-foreground`/`--color-muted` (which must be checked visually on both neu
  materials during verification); the aurora never carries text.
- Reduced motion: everything rides the token collapse; the LED pulse and any ambient glow
  animation are tagged loops that also get a `[data-motion="reduced"]`/media kill rule
  (glow loops are ambient but attention-grabbing — unlike spinners they carry no state, so
  they stop under reduced motion).

## 6. Verification

- Motion gate (`npm run build`) stays clean; no validator run (no mark-color changes —
  asserted in the diff by `--chart-*` being untouched).
- Browser walkthrough both themes: power panel composition, knob drag + keyboard +
  Escape-cancel, stepper hold-to-repeat + bounds, gauge tween + ticks, LED pulse +
  reduced-motion kill, all `surface="neu"` variants beside their glass selves on
  /components.
- `node tools/minify.js` + `npm run test:tools` green.

## 7. Fleet propagation

Extend the MANIFEST `glass-dataviz-set` capability or add `neu-surface-tier` (implementer:
add new `[[capabilities]]` entry — the tier is independently borrowable but depends on
motion tokens + `motionMs`). Same sync-`src/shared/`-wholesale rule.
