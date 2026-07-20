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
| ax-gauge | value, max, unit, label, ticks†, height† | value | — | — | absent value → data-empty |
| ax-stepper ⚑ | value, min, max, step, label, name, orientation | value; form-associated (submits value) | change ({value}) | — | orientation="horizontal" (default vertical); min/max/step default 0/100/1; pill-level `role="spinbutton"` (the pill itself is the single tab stop — the two chevron buttons are `tabindex="-1"`) |
| ax-led | tone (ok\|info\|warn\|danger\|off), pulse, label | — | — | — | no label → decorative (aria-hidden); label present → role="status" |
| ax-knob ⚑ | value, min, max, step, size†, label, name | value; form-associated (submits value) | input/change ({value}) | — | min/max/step default 0/100/1 |

## Surfaces & utilities
- Glass: `.glass-panel` (outer sheet), `.glass-tile` (nested).
- Neu: `.neu-panel` (raised, gradient face), `.neu-well` (inset), `.neu-glow` (aurora).
- Motion: consume `var(--duration-*)`/`var(--ease-*)` only; JS waits via
  `motionMs()` from `@shared/motion.js`. `npm run lint:motion` enforces.
- Chart colors: `--chart-1..4` only, fixed slot order (validator-frozen — see
  theme.css comment before changing).
