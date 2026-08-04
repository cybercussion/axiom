# Axiom Controls — Agent Reference

Every `ax-*` control follows ONE contract shape: **attributes/properties in,
composed `CustomEvent`s with `detail` out**. Skins via `surface="neu"` and
`variant` attributes. Structured data goes in via JS PROPERTY (primary) or
JSON attribute (markup); an explicitly set property permanently wins.
Reactivity: attributes in a control's observedAttributes are live. Pure-CSS skin
attrs are ALSO live even when unobserved (CSS attribute selectors re-match on
mutation). Attributes baked into shadow markup at render time are
construction-time — set them before inserting the element; they are marked †.
Import: `import '@shared/controls/<tag>.js'` — importing defines the element.
Form-associated controls (marked ⚑) submit under their `name` attribute — set it like any native input.

Form-entry controls (ax-field/ax-textarea/ax-select/ax-checkbox/ax-segment) differ from
hardware controls in three deliberate ways: their `label` attr renders a VISIBLE label;
validation messages follow a "touched" model (nothing shows before first blur or
`reportValidity()` — do NOT style `ax-*:invalid` from page CSS, hosts match `:invalid`
from first paint); and text wells show their focus ring on pointer focus too
(focus-within chrome — carets need visible context). ax-toggle vs ax-checkbox: a toggle
is a live setting that applies immediately; a checkbox is a form choice submitted later.

| Tag | Attributes | Properties | Events (detail) | Slots | Variants |
|-----|-----------|------------|-----------------|-------|----------|
| ax-toggle ⚑ | checked, disabled, label, name, value | checked | change ({checked}) | — | surface="neu" (slide switch) |
| ax-dipswitch ⚑ | switches="A,B"†, on="A"†, label†, name, surface† | value → {label:bool}; setAll(map,{stagger}) | change ({label, checked, value}) | — | surface="neu" (rocker bank, forwards to toggles) |
| ax-slider ⚑ | min†, max†, step†, value, label, name, disabled, variant, surface | value (number) | input/change ({value}) | icon (variant="fill") | variant="fill", surface="neu" |
| ax-progress | value, max, indeterminate, label, surface | value | — | — | surface="neu"; absent value → indeterminate |
| ax-button ⚑ | variant†(fill\|outline\|ghost), tone†(primary\|secondary\|success\|warning\|danger), type(button\|submit), name, loading, disabled, surface, shape | — | click (native) | default label | surface="neu" (raised key); shape="round" (only has effect combined with surface="neu") |
| ax-popover | open (reflected), aria-label (consumer-set; internals.role="group") | open (getter); show(invoker)/hide()/toggle(invoker) | popover-open, popover-close | default | surface="neu" |
| ax-skeleton | done | — | — | — | — |
| ax-barchart | data (JSON), max, unit, label | data = [{label,value}] (property wins over attribute) | — (tooltips internal) | — | surface="neu" |
| ax-ring | segments (JSON), size†, label† | segments = [{label,value}] (property wins over attribute) | — (tooltips internal) | default (center), legend (built-in fallback, suppressed for <2 segments) | surface="neu" |
| ax-progress-ring | value, size†, label | value | — | — | surface="neu" |
| ax-stat | value, unit, label | value | — | icon, trend | surface="neu" |
| ax-trend | value (signed), good | value | — | — | — |
| ax-chip | tone (ongoing\|complete\|neutral) | — | — | default label | surface="neu" |
| ax-datestrip | date (ISO), selected (ISO), label† | selected | change ({date}) | — | surface="neu" |
| ax-gauge | value, max, unit, label, ticks†, height† | value | — | — | absent value → data-empty; aurora plasma fill (CSS-only, ambient drift, reduced-motion aware) |
| ax-stepper ⚑ | value, min, max, step, label, name, orientation | value; form-associated (submits value) | change ({value}) | — | orientation="horizontal" (default vertical); min/max/step default 0/100/1; pill-level `role="spinbutton"` (the pill itself is the single tab stop — the two chevron buttons are `tabindex="-1"`) |
| ax-led | tone (ok\|info\|warn\|danger\|off), pulse, label | — | — | — | no label → decorative (aria-hidden); label present → role="status" |
| ax-knob ⚑ | value, min, max, step, size†, label, name | value; form-associated (submits value) | input/change ({value}) | — | min/max/step default 0/100/1 |
| ax-field ⚑ | type†(text\|email\|password\|number\|search), value, label, placeholder, required, minlength†, maxlength†, autocomplete†, name, disabled, error | value (live text), error (custom-validity proxy), reportValidity() | input/change ({value}) | prefix, suffix | surface="neu" (carved well); message shows after first blur (touched model) |
| ax-textarea ⚑ | value, label, placeholder, required, minlength†, maxlength†, rows†, max-rows†, name, disabled, error | value, error, reportValidity() | input/change ({value}) | — | surface="neu"; auto-grows to max-rows (default 3→8) |
| ax-select ⚑ | options (JSON), value, label, placeholder, required, name, disabled | options = [{value,label}] (property wins over attribute); value; reportValidity() | change ({value, label}) | — | surface="neu" (carved well); the open menu is ALWAYS an opaque raised panel; full keyboard listbox (arrows/Home/End/type-ahead/Escape) |
| ax-checkbox ⚑ | checked, disabled, label, value, name | checked | change ({checked}) | — | surface="neu" (raised tile → pressed lit well); VISIBLE label; Space toggles |
| ax-segment ⚑ | options="A,B,C", value (selected label; defaults first), label, name, disabled | value | change ({value, index}) | — | surface="neu" (carved rail, raised puck); arrows move AND select (radio parity) |
| ax-flow | sources (JSON), sinks (JSON), unit, label | sources/sinks = [{label,value}] (property wins per side) | — (hover internal, native title tooltips) | default (hub center) | surface="neu" (carved hub disc); side-coded ribbons (--chart-1 sources / --chart-4 sinks, identity via labels); >4 per side folds to Other |
| ax-bento | cols, rows, gap, preset (collage\|hero\|dash), collapse (px, default 640; "none" disables); CHILD attrs: span, rows, area ("rs / cs / re / ce") | — | — | default (slotted children become grid items) | pure layout, tier-agnostic (no chrome — children bring their own surface); preset places by DOM index, child attrs override their slot, extras auto-flow; DOM order is never reordered (reading order = source order); below collapse threshold everything stacks single-column, reflected as data-collapsed (public, styleable) |

## Surfaces & utilities
- Glass: `.glass-panel` (outer sheet), `.glass-tile` (nested).
- Neu: `.neu-panel` (raised, gradient face), `.neu-well` (inset), `.neu-glow` (aurora).
- Motion: consume `var(--duration-*)`/`var(--ease-*)` only; JS waits via
  `motionMs()` from `@shared/motion.js`. `npm run lint:motion` enforces.
- Chart colors: `--chart-1..4` only, fixed slot order (validator-frozen — see
  theme.css comment before changing).
