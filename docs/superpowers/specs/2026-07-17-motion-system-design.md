# Axiom Motion System + Shared Control Set — Design

**Date:** 2026-07-17
**Status:** Approved (Approach A — CSS-native springs, zero dependencies)
**Scope:** Base Axiom (upstream for the fleet). Downstream projects inherit via `theme.css` adoption and `src/shared/controls/`.

## Goal

A fleet-wide motion system with a hard rule: **no fast default vanilla behavior**. Every
state change animates — no `display: none` hard cuts, no unstyled native controls, no
ad-hoc durations. Personality is **hybrid**: cinematic route transitions (existing
language, retokenized), springy tactile physics for interactive controls. Everything is
mobile-friendly: 44px touch targets, drag support, no hover-only affordances.

## Non-goals

- No JS spring engine (WAAPI/interruptible physics). CSS `linear()` springs cover this
  pass; a gesture-grade engine can layer on later without rework.
- No third-party motion library — zero-dependency house rule stands.
- No dock hover magnification (hover-dependent, dies on touch — explicitly skipped).
- No redesign of colors/typography/layout; this pass is motion + controls only.

## 1. Motion token layer

**Files:** `src/shared/styles/theme.css` (token block), `src/shared/styles/animations.css`
(route transitions, rewritten to consume tokens).

New tokens in `:root`:

```css
/* Durations */
--duration-instant: 100ms;
--duration-fast: 200ms;
--duration-base: 300ms;
--duration-slow: 500ms;

/* Easings */
/* snappy, ~8% overshoot — toggles, buttons, dock pill */
--ease-spring: linear(0, 0.006, 0.025 2.8%, 0.101 6.1%, 0.539 18.9%, 0.721 25.3%,
    0.849 31.5%, 0.937 38.1%, 0.968 41.8%, 0.991 45.7%, 1.006 50.1%, 1.015 55%,
    1.017 63.9%, 1.001);
/* softer settle, minimal overshoot — menus, popovers */
--ease-spring-gentle: linear(0, 0.013, 0.054 3.9%, 0.219 8.7%, 0.42 13.3%, 0.596 17.9%,
    0.744 22.6%, 0.863 27.8%, 0.945 33.4%, 0.997 40%, 1.021 48.3%, 1.016 61.4%, 1.003);
--ease-out-soft:      cubic-bezier(0.16, 1, 0.3, 1);   /* existing curve, canonicalized */
--ease-cinematic:     cubic-bezier(0.4, 0.0, 0.2, 1);  /* route transitions, canonicalized */
```

Rules:

- **No literal `cubic-bezier(...)` or `ms`/`s` duration anywhere outside the token
  block.** Grep-verifiable. All six existing ad-hoc combos (theme.css ×4, forms.css,
  toast.css, dashboard.css, navigation.css) migrate onto tokens. `--ease-elastic` is
  replaced by `--ease-spring`.
- Route-transition tokens (`--transition-duration`, `--transition-easing`) fold into the
  scale above; `animations.css` keeps the forward/back/scale/fade variants but consumes
  the shared tokens.
- **Global reduced-motion block**: one `@media (prefers-reduced-motion: reduce)` rule that
  collapses springs/slides to fast opacity fades across ALL components, not just routes.
  Lives in theme.css so every shadow root inherits it via BaseComponent adoption.
- Show/hide animates both directions using `@starting-style` +
  `transition-behavior: allow-discrete` — the canonical pattern for killing
  `display: none` hard cuts, used by ax-popover and anything else that toggles visibility.

## 2. Shared controls — `src/shared/controls/`

Each control is a `formAssociated` Web Component extending `BaseComponent`
(ElementInternals for form value + ARIA role), themed exclusively via theme.css tokens,
with 44px minimum touch targets and full keyboard support. One file per control plus a
shared `controls.css` adopted via `addExternalStyles`.

| Tag | Behavior | Motion |
|-----|----------|--------|
| `ax-toggle` | Single switch; role=switch; form value on/off; keyboard Space/Enter | Thumb slides with `--ease-spring` snap; track color cross-fades |
| `ax-dipswitch` | Bank of N labeled toggles (hardware DIP look); emits one value map (`{label: bool}`); each switch individually keyboard-focusable | Per-switch spring snap; staggered settle on programmatic set-all |
| `ax-slider` | Styled range: filled track, custom thumb; pointer + touch drag; keyboard arrows; form value | Thumb scales up on grab (spring), value bubble fades/pops in during interaction, fill animates on programmatic change |
| `ax-progress` | Determinate (0–100) + indeterminate; role=progressbar | Value changes tween — never jump; indeterminate shimmer loop |
| `ax-button` | Button with variants (primary/outline) and built-in loading state | Press-down scale (~0.96) on active, springy release; label↔spinner cross-fade for loading |
| `ax-popover` | Anchored menu/panel; light-dismiss (outside click + Escape); focus-managed | Scale-pop from anchor origin with `--ease-spring-gentle`; **animated exit** via `@starting-style` + allow-discrete |
| `ax-skeleton` | Shimmer placeholder block for async content | Shimmer sweep; cross-fades out when content arrives |

Notes:

- Controls integrate with the existing focus-registry / keyboard-policy / announce-bus
  infrastructure where applicable (popover focus trap uses the same conventions as
  `modal.js`).
- `_esc()` convention applies to any interpolated labels.
- Controls do NOT subscribe to global state; they are dumb value-in/event-out primitives.
  Consumers (dock, features) wire them to `state`.

## 3. Dock retrofit — `src/features/navigation/`

- **Settings menu → `ax-popover`** containing `ax-toggle` (theme, captions) and
  `ax-slider` (audio). Menu now animates closed instead of `display: none` vanishing.
- **Sliding active pill**: springy indicator that FLIP-morphs between nav items on route
  change (~30 lines of measurement JS — the one place CSS can't know positions). Replaces
  the static `.active` background. Works identically on touch and pointer.
- **Press feedback**: subtle scale-down on nav icon tap/click (`:active`, spring release).
- Existing gotchas respected: `composedPath()` click interception, no second
  `view-transition-name`, dock stays outside `#app-container`.

## 4. Showcase route — `/components`

New feature (`node tools/create-feature.js components` scaffold) registered in
`app-routes.js` (ROUTES, ROUTE_DEPTHS, ROUTE_ORDER). The page exercises:

- Every ax-* control, live and interactive, with usage snippets.
- The motion token scale visualized (duration bars, easing curve demos).
- All four route-transition variants (links that trigger each).
- A reduced-motion preview toggle to verify fallbacks without flipping OS settings.

Serves as the fleet reference page and the manual verification surface.

## 5. Error handling / edge cases

- **Older browsers without `linear()` or `@starting-style`**: provide fallback easing
  (`--ease-out-soft`) via standard cascade (declare fallback first, spring second);
  popover falls back to instant show/hide — functional, just less animated. No JS feature
  detection needed.
- Slider drag must not fight route swipes: `touch-action: none` on the thumb only.
- Popover repositions if anchored near viewport edge (flip above/below); dock menu keeps
  its current above-the-dock placement.
- `ax-progress` clamps values 0–100; NaN → indeterminate.

## 6. Testing / verification

- Browser walkthrough (Claude-driven Chrome): every control operated, every route
  transition triggered, popover open/close both animated, dock pill slides on nav.
- Reduced-motion check via showcase toggle + OS emulation.
- Mobile-width check (≤768px): touch targets, dock layout, slider drag.
- Form participation: an `ax-toggle` inside the contact form submits its value.
- `node tools/minify.js` from project root passes all build guards.
- Grep gate: no literal `cubic-bezier`/durations outside the token block.

## 7. Fleet propagation

Base Axiom is upstream (see MANIFEST.toml / no-fork-and-drift policy). Downstream
projects pick this up by syncing `src/shared/styles/` and `src/shared/controls/`;
the motion tokens ride along automatically wherever theme.css is adopted. Record the
capability in MANIFEST.toml when shipped.
