# ax-flow — Two-Sided Flow Visualizer Design Spec

**Date:** 2026-07-22
**Status:** Approved direction (Mark): side-coded color, neu-stage showcase panel.
**Reference:** Mark's "Datalytics" neumorphic dashboard image (2026-07-21) — sources fan
into a circular total hub, sinks fan out the other side.

## Goal

One new display control, `<ax-flow>`: a constrained two-sided Sankey (N sources → center
hub → M sinks) rendered as hand-rolled SVG ribbon paths. Joins the ax-* fleet (24th
control) and fills the empty column in the /components Cyber-Neumorphism stage.

## Non-goals

- No general Sankey (no multi-level graphs, no layout solver — the topology is fixed).
- No click/selection events in v1 — display + hover only.
- No dashboard placement this pass (showcase only; dashboard can adopt later).
- No new tokens, no palette changes.

## Contract

```html
<ax-flow label="Sales flow" unit="$"
  sources='[{"label":"Business","value":20450},{"label":"Education","value":40000}]'
  sinks='[{"label":"Investments","value":75000},{"label":"Startups","value":7500}]'>
  <span class="hub-title">Total Sales</span>
  <strong class="hub-num">305</strong>
</ax-flow>
```

- **Attrs observed:** `sources` (JSON), `sinks` (JSON), `unit`, `label`.
- **Properties:** `sources`, `sinks` — arrays of `{label, value}`; property-wins with
  independent `_propSet` flags per side (ax-ring precedent). Malformed JSON → empty
  side + `log.warn`, never a throw.
- **Slot:** default slot renders inside the hub disc (consumer composes title/total —
  ax-ring center precedent). Slot content is HTML overlaid on the hub via
  `<foreignObject>`-free absolute positioning (HTML layer above the SVG, centered on
  the hub — simpler and more stylable than SVG text).
- **Folding:** more than 4 entries on a side → keep the top 3 by value, fold the rest
  into `Other` (sum), per the dataviz method.
- **Values:** non-finite or negative values are dropped with `log.warn`; an empty side
  renders the other side only; both sides empty → hub + slot only.
- **Events:** none. Hover is internal.
- **Variants:** `surface="neu"` — hub disc carves (`--neu-surface-deep` + `--neu-well`);
  base surface renders the hub as a `--glass-tile`-style disc. Ribbons identical on
  both surfaces.

## Geometry

- SVG `viewBox="0 0 720 340"`, `width: 100%; height: auto` — scales with its container;
  single-column mobile gets full width.
- Hub: circle center (360, 170), radius 64, plus a decorative dashed orbit ring at
  r = 84 (`aria-hidden`, `stroke-dasharray`, `--color-muted` at low opacity).
- Ribbons: closed paths of two cubic beziers (control points at the horizontal midpoint
  between end x-positions — classic Sankey link). CONSTANT thickness along the ribbon,
  proportional to value, normalized PER SIDE: each side's thicknesses + 2px gaps sum to
  at most 168px (the hub's vertical extent plus margin); the stack is vertically
  centered on the hub.
- Outer ends: x = 150 (sources) / x = 570 (sinks), stacked with a WIDER 16px gap —
  this outer spread converging into the tight 2px hub stack is what produces the
  reference's fan; ribbon thickness itself stays constant (hub-scale) at both ends.
  Vertically centered; the 0–150px left of each source ribbon holds its label block.
- Hub ends: ribbons terminate at x = 296 (sources) / x = 424 (sinks) — the hub disc
  edge (center 360 ± r 64) — visually plunging behind the disc (ribbons render BELOW
  the disc in paint order).
- 2px gaps between adjacent ribbons at both ends (method spacer rule — the panel
  surface shows through).

## Color (adjudicated: side-coded)

- ALL source ribbons wear `--chart-1`; ALL sink ribbons wear `--chart-4`. Color encodes
  SIDE; identity is carried by the always-visible per-ribbon labels — never color-alone,
  so the method holds.
- Per-side `<linearGradient>` (userSpaceOnUse, horizontal): solid chart color at the
  outer end → `color-mix(in srgb, var(--chart-N) 55%, white)` at the hub end. Same-hue
  lightness ramp = sequential, method-legal. Two gradient defs total, shared by all
  ribbons on a side.
- Chart marks never use `--accent-glow` (that stays a control-indicator color). Optional
  soft glow under the hub disc on `surface="neu"` derives from `--neu-glow`, not from
  chart hues.
- Text (labels, values, hub content) wears text tokens (`--color-foreground` /
  `--color-muted`) — never the ribbon color.

## Labels

- Each ribbon's outer end gets a two-line SVG text block OUTSIDE the ribbon (left of
  sources, right of sinks): line 1 label (`--text-xs`-equivalent size in viewBox units,
  `--color-muted`), line 2 value with `unit` prefix (`--color-foreground`, 600 weight).
  Sinks right-anchored, sources left-anchored.
- Long labels truncate at 14 chars with `…` (SVG has no ellipsis; JS truncates, full
  label lives in the `<title>` and the sr-only summary).

## Hover & a11y

- Hovering a ribbon: it rises to full opacity while sibling ribbons dim to 0.35
  (`opacity` transition, `--duration-fast` `--ease-out-soft`). Each `<path>` carries
  `<title>label: unit+value</title>` for the native tooltip.
- Host: `internals.role = 'group'`, `internals.ariaLabel` from `label` attr (default
  "Flow chart").
- sr-only HTML summary (rebuilt on data change): "Total N unit from X sources to Y
  sinks. Largest source: A (v). Largest sink: B (v)." — plus a hidden list of every
  label/value pair (the chart's table-view equivalent).
- SVG root is `aria-hidden="true"` (the sr-only summary is the accessible surface).

## Motion

- Entrance: ribbons fade + scale from the hub outward (`transform-origin` center,
  `opacity`/`transform` transition, `--duration-slow` `--ease-out-soft`) via a
  `data-ready` attribute set after first paint (double-rAF). Reduced motion collapses
  through the token system automatically.
- No animation on data swap beyond the entrance replay — swapping datasets re-renders
  ribbons and replays the fade (cheap, honest).

## Showcase (/components)

New wide panel in `.neu-stage`, after `.neu-form-panel`:

- `.neu-panel.neu-flow-panel` (flex column, `flex: 2; min-width: 560px` so it takes the
  empty column; wraps under the form panel on narrow widths).
- Top row: `ax-segment surface="neu" options="1W,1M,2M,1Y" value="2M" label="Range"`.
- `<ax-flow surface="neu" unit="$" label="Sales flow">` with hub slot: "Total Sales" /
  big numeral / sub-line — numeral styled like `.power-num` (light display numerals).
- Wiring in `_wire()`: a canned dataset object keyed by range (`1W/1M/2M/1Y`, four
  variations of the reference's Business/Education/Travel/Development →
  Investments/Startups/Outsourcing/Projects data); segment `change` assigns
  `flow.sources = ...; flow.sinks = ...` (property path) and updates the hub numeral —
  proving property-wins reactivity and cross-control composition.

## Docs / manifest / gates

- CONTROLS.md: 24th row — `ax-flow | sources (JSON), sinks (JSON), unit, label |
  sources/sinks = [{label,value}] (property wins) | — (hover internal) | default (hub
  center) | surface="neu" (carved hub); side-coded ribbons (--chart-1 sources /
  --chart-4 sinks); >4/side folds to Other`.
- MANIFEST.toml: extend the `glass-dataviz-set` claim with ax-flow (it is a chart, not
  a neu-tier primitive) — append ", ax-flow two-sided flow/Sankey (side-coded ribbons,
  center hub slot)" after the existing chart list; entry_points unchanged.
- Gates: `npm run lint:motion`, `npm run build`, `npm run test:tools`; controller
  live-browser milestone (ribbons render both themes, hover dim, segment swap replays
  entrance, labels legible at mobile width, sr-only summary present, reduced-motion
  snap).

## Risks / notes

- SVG text sizing scales with viewBox — at very narrow widths labels shrink;
  mitigated by the panel's `min-width: 560px` and single-column mobile giving full
  viewport width. Real-device check stays on the standing follow-up list.
- The double-rect lesson applies: ax-flow renders no native inputs, so the adopted
  theme sheet's GLOBAL FORMS rules can't collide here; no `.well` chrome is used.
