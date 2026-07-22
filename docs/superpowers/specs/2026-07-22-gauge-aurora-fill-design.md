# ax-gauge Aurora Fill — Design Spec

**Date:** 2026-07-22
**Status:** Approved direction (Mark): CSS-only, slow drift, fixed palette.
**Reference:** Mark's glowing plasma battery image — blue base, gold core, white-hot
center, soft blurred blobs inside the capsule.

## Goal

Upgrade `ax-gauge`'s fill from the current two-stop gradient to a living "aurora
plasma" — the reference look — as a pure-CSS change inside `src/shared/controls/ax-gauge.js`.
No API change, no new files, no canvas.

## Adjudications (locked)

- **CSS, not canvas:** stacked radial-gradients + `filter: blur()` on a pseudo-element,
  GPU-composited, theme-token reactive, reduced-motion integrated. Canvas would lose
  token/theme/motion integration for zero visual gain at this fidelity.
- **Default look, not a variant:** every ax-gauge gets the aurora (the numeral/ruler
  carry the reading; the fill is pure indicator). No new attribute.
- **Warm core color source:** `color-mix(in srgb, var(--warning-color) 75%, white)` —
  documented in-code as DECORATIVE energy-glow, not a status signal. Blue base from
  `--accent-glow` (control value indicator — its contractual use). Hot spot is plain
  white at partial alpha. No new tokens.
- **Motion:** one ambient keyframe loop (~9s, alternate, infinite) drifting/scaling the
  plasma layer. Literal duration carries the `/* motion-gate: allow */` tag (ambient
  loop precedent: ax-led pulse). Easing via `var(--ease-cinematic)`.
  `@media (prefers-reduced-motion: reduce)` sets `animation: none` (the OS setting
  governs; the [data-motion] preview can't pierce shadow CSS — ax-led precedent).

## CSS changes (all in ax-gauge.js's CSS constant)

1. `.fill` — add `overflow: hidden;` (it becomes the clip window for the oversized
   plasma; `.well`'s clip alone can't crop the plasma to the fill's rounded top edge).
   Existing background REPLACED by a dim base wash:
   `background: color-mix(in srgb, var(--color-primary) 30%, transparent);`
   Keep: position/inset, border-radius, height transition, outer glow box-shadow.
2. `.fill::before` — the plasma:
   - `content: ''; position: absolute; inset: -40%;` (oversize so blur never fades at
     the capsule walls)
   - `background:` three stacked radial-gradients, top-to-bottom paint order:
     - hot spot: `radial-gradient(30% 22% at 52% 62%, rgba(255, 255, 255, 0.85) 0%, transparent 60%)`
     - gold core: `radial-gradient(55% 40% at 46% 52%, color-mix(in srgb, var(--warning-color) 75%, white) 0%, transparent 58%)`
     - blue base: `radial-gradient(65% 48% at 50% 86%, color-mix(in srgb, var(--accent-glow) 85%, white) 0%, transparent 62%)`
   - `filter: blur(14px) saturate(1.15);`
   - `animation: ax-gauge-aurora 9s var(--ease-cinematic) infinite alternate;` with the
     motion-gate allow tag on this line.
3. `@keyframes ax-gauge-aurora` —
   `from { transform: translate(-2%, 2%) scale(1); }`
   `to { transform: translate(3%, -5%) scale(1.08); }`
4. Reduced motion block killing the animation (comment per ax-led).
5. `data-empty` — existing rule extends: `:host([data-empty]) .fill::before { content: none; }`
   (no plasma on an empty reading; the fill is 0-height anyway, this is belt-and-braces).

## Unchanged

Height-based fill tween (`--duration-slow`), ruler, ARIA meter internals, sr-only
summary, stepper→gauge showcase wiring, `height`/`ticks` construction-time attrs.

## Docs & gates

- CONTROLS.md ax-gauge row, Variants cell: append "; aurora plasma fill (CSS-only,
  ambient drift, reduced-motion aware)".
- Gates: `npm run lint:motion` (the 9s literal must be tag-allowed), `npm run build`,
  `npm run test:tools`. Browser milestone: power panel in BOTH themes — plasma drifts,
  stepper still tweens the fill height smoothly, empty state (remove value attr) shows
  no plasma, reduced-motion freezes the drift; check the fill's top edge stays a crisp
  rounded cap (the clip), not a blurred smear.

## Risks

- Blur inside a height-animating clip re-rasterizes during the tween — the plasma is
  56px wide and GPU-friendly; if the tween stutters on low-end hardware, the fallback
  is pausing the drift during the height transition (not expected to be needed).
- Subpixel lessons apply: the plasma is its own composited layer (animated transform),
  siblings are opaque — no opacity-group snapping hazard like the LED case.
