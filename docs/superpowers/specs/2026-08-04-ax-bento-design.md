# ax-bento — Design Spec

**Date:** 2026-08-04
**Status:** Approved direction (Mark): component (not CSS layer), one-threshold collapse,
collage + hero + dash presets, preset-switcher card + /dashboard migration.
**Reference:** Flexbox Labs grid playground (github.com/prazzon/flexbox-labs, MIT) —
its "Collage" preset is the bento look Mark liked; its preset-as-data mechanism is
what we vanilla-ize. Their presets are fixed-track; the responsive collapse is ours.

## Goal

25th control: `ax-bento` (`src/shared/controls/ax-bento.js`) — a pure-layout CSS Grid
host for bento compositions. No tile chrome, tier-agnostic (children bring their own
glass/neu surface). Ships with three data presets, freeform span/area placement, and
container-based single-column collapse. `/components` gets a preset-switcher card;
`/dashboard` migrates its hand-rolled `.dash-grid` onto `preset="dash"`.

## API

Host attributes (all live-reactive, no construction-time attrs):

- `cols` — integer count (`"4"` → `repeat(4, 1fr)`) or literal track list
  (`"1.2fr 0.8fr 1fr"`). Default `4`.
- `rows` — same forms, optional. Default: auto rows (`grid-auto-rows: auto`).
- `gap` — CSS length. Default `var(--space-m)`.
- `preset` — `collage | hero | dash`. Supplies tracks AND per-child placement by
  DOM index. Precedence: an explicit `cols`/`rows` attr on the host overrides the
  preset's tracks; an explicit `span`/`rows`/`area` attr on a child overrides the
  preset's slot for that index. Children beyond the preset's slot count auto-flow.
- `collapse` — px threshold (number). Default `640`; `"none"` disables.

Child attributes (on slotted light-DOM elements — the consumer's own markup):

- `span` — column span (integer).
- `rows` — row span (integer).
- `area` — full `grid-area` value (`"1 / 1 / 2 / 3"`, row-start/col-start/row-end/col-end).
  `area` wins over `span`/`rows` on the same child.

Attrs-only contract for v1 (adjudicated): no property mirrors / `_propSet` — a layout
container's API is its markup; add property paths only when a consumer needs them.

## Mechanics (adjudications locked)

- **Shadow structure:** `<div class="grid"><slot></slot></div>`; `slot { display: contents }`
  so slotted children participate as grid items of `.grid`. `:host { display: block }`
  declared explicitly (themeSheet `:host{display:block}` trap — never rely on it).
- **Custom-prop indirection, never inline layout styles on children.** The host writes
  only private custom properties onto children's inline style (`--_ba` for grid-area,
  `--_bc`/`--_br` for spans) and removes them when attrs/preset go away. Shadow rules
  consume them: `::slotted(*) { grid-area: var(--_ba, auto) }`,
  `::slotted([span]) { grid-column: span var(--_bc, 1) }`, likewise `[rows]`. Presets
  place via `--_ba` (or `--_bc` for track-only presets like dash), so preset-placed
  children need no attrs. This keeps the collapse a rule-level override — no
  specificity war against inline styles.
- **Liveness:** `slotchange` (use `assignedElements()`, never raw nodes) plus one
  MutationObserver (subtree childList + attributeFilter `span|rows|area`) → re-apply
  placements. Observers created once per instance in the constructor (house invariant),
  observe/unobserve in connected/disconnectedCallback.
- **Collapse = ResizeObserver, not `@container`.** Container-query thresholds cannot
  read a custom property or attribute, so a configurable `collapse` needs JS: RO on the
  host toggles `data-collapsed` on the host (state-change-guarded — no toggle unless
  crossing the threshold, avoiding RO feedback loops). Shadow CSS:
  `:host([data-collapsed]) .grid { grid-template-columns: 1fr }` and
  `:host([data-collapsed]) ::slotted(*) { grid-area: auto; grid-column: auto; grid-row: auto }`.
  Stack order = DOM order. `data-collapsed` is documented public state consumers may
  style against.
- **A11y:** no roles — it's layout. Presets place visually but NEVER reorder DOM, so
  screen-reader/keyboard order is source order at every width; collapse stacks in that
  same order. This is the a11y story and it's free.
- **Motion:** none in the control (layout snaps). Nothing for motion-gate.

## Presets (pure data in ax-bento.js, geometry credited to flexbox-labs in a header comment)

- `collage` — 4×4, 9 slots (their Collage verbatim, as grid-area):
  `1/1/2/3`, `2/2/4/4`, `1/3/2/4`, `1/4/3/5`, `3/1/5/2`, `3/4/4/5`, `4/3/5/5`,
  `4/2/5/3`, `2/1/3/2`.
- `hero` — 3×3, 6 slots: `1/1/3/3` (dominant), `1/3/2/4`, `2/3/3/4`, `3/1/4/2`,
  `3/2/4/3`, `3/3/4/4`.
- `dash` — tracks `1.2fr 0.8fr 1fr`, auto rows; slots 1–3 auto-place, slot 4 gets
  column `1 / 3` (today's `.panel-challenges` geometry).

Slot data shape: `{ cols, rows?, slots: [{ area? , colStart?/colEnd? } ...] }` — an
entry may give a full area or column lines only (dash). Adding a preset is data-only.

## Consumers

- **/components card:** 9 numbered glass tiles in an `ax-bento`, `ax-segment`
  (collage / hero / dash) flips the `preset` attr. Swap wrapped in
  `document.startViewTransition?.()` with card-local per-tile `view-transition-name`s
  (router precedent; guard means graceful snap where unsupported). Hero shows 3 extras
  auto-flowing, dash shows 5 — the overflow behavior demos itself. Card copy notes the
  Flexbox Labs inspiration.
- **/dashboard migration:** `.dash-grid` div → `<ax-bento preset="dash" collapse="900">`;
  the `.dash-grid` layout rules and the 900px media query are DELETED (collapse attr
  replaces it; 900 preserved, not 640). Non-layout `.dash-grid` styles (h2 etc.) move
  to a surviving hook. Visual parity is the acceptance bar.

## Docs & gates

- `docs/CONTROLS.md`: new ax-bento row — not form-associated, no † attrs; document
  host/child attrs, presets, `data-collapsed`.
- Gates: `npm run build` (includes motion-gate), `npm run lint:motion`, `npm run test:tools`.
- Browser milestone (window FOCUSED, per the focus-testing trap): both themes; preset
  swap animates (and degrades to snap sans view-transitions); collapse proven
  CONTAINER-based by nesting a narrow ax-bento beside a wide one in the same viewport;
  child attr overriding a preset slot; dashboard before/after parity at wide + <900px;
  reduced-motion: preset swap must not animate (card skips startViewTransition when
  reduced — check `[data-motion="reduced"]` / media query at the card level).

## Risks

- `::slotted` + `display: contents` slot grid participation is standard, but verify
  Safari during the browser milestone (first control relying on slotted-as-grid-item).
- RO threshold + scrollbar appearance can oscillate width across the boundary —
  state-change guard plus threshold compare on `contentBoxSize` should hold; if a real
  oscillation shows up, add small hysteresis (±8px) rather than debouncing.
- Index-based preset assignment assumes element children only — `assignedElements()`
  handles text nodes/comments by construction.
- `view-transition-name` must be unique per tile per page — card-local names
  (`bento-tile-1`…) and only one animated bento on /components.

## Follow-ups (not v1)

- Full playground card (ax-slider gap, ax-stepper cols, ax-select flow) — deferred.
- More presets as consumers appear (data-only additions).
- Property mirrors if a JS consumer materializes.
