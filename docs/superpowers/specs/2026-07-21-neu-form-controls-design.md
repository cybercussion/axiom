# Neu Form Controls — Design Spec

**Date:** 2026-07-21
**Status:** Approved direction (Mark, 2026-07-21): five controls + custom listbox + contact migration.

## Goal

Complete the input side of the design system: five form controls that join the 18-control
`ax-*` fleet, give the Cyber-Neumorphism tier something to type into, and retire the legacy
`custom-input` + `FormValidator` stack so exactly ONE form tradition remains.

**New controls:** `ax-field`, `ax-textarea`, `ax-select`, `ax-checkbox`, `ax-segment`.
**Migration:** `/contact` rebuilt on the new controls; `custom-input.js`, `form-validator.js`,
`shared/styles/forms.css` deleted.
**Showcase:** a wired "Neu form" panel in the /components Cyber-Neumorphism section.

## Non-goals (explicit)

- No retrofit of the form-lifecycle mixin onto EXISTING controls (toggle/stepper/slider/
  dipswitch/knob) — that stays on the follow-up list.
- No multi-select or filtering combobox for ax-select; single-select only.
- No date/time pickers, no file inputs, no masked inputs.
- No new validation framework — the platform's Constraint Validation API, mirrored through
  `ElementInternals`, is the whole story.

## Architecture

Approach A from brainstorming: each control is a single file in `src/shared/controls/`
(fleet tradition), drawing on two NEW shared modules:

### 1. `src/shared/controls/field-chrome.js`

Exports one CSS string, `FIELD_CHROME_CSS`, appended into the `addStyles()` call of
ax-field / ax-textarea / ax-select (the three well-shaped controls). No JS. Contents:

- `.control-label` — visible label line above the well: `var(--text-sm)`, 600,
  `var(--color-muted)`, uppercase, `letter-spacing: 0.05em` (matches the global `label`
  rule in theme.css so shadow and light forms look identical).
- `.well` — the input container. **Base look = today's global input styling** (this keeps
  glass-context forms like /contact identical to before): `background: var(--input-bg);
  border: 1px solid var(--input-border); border-radius: 12px;` inset shadow
  `inset 0 2px 4px rgba(0, 0, 0, 0.2)`; transitions on background/border-color/box-shadow
  using `var(--duration-base) var(--ease-out-soft)`.
- Focus (on `.well:focus-within`): the existing focus treatment — border-color
  `var(--color-primary)`, `box-shadow: inset 0 2px 4px rgba(0,0,0,0.1),
  0 0 0 4px rgba(59, 130, 246, 0.1)`. Inner input has `outline: none` (the well IS the
  ring); the universal modality system doesn't apply here because the ring is a
  focus-within style, not `:focus-visible` — text fields conventionally show their ring
  on pointer focus too (caret placement), so pointer suppression is NOT wanted.
- `:host([surface="neu"]) .well` — carved: `background: var(--neu-surface-deep);
  border: none; box-shadow: var(--neu-well);` focus-within adds a 1px
  `var(--color-primary)` ring via box-shadow (no outline — matches neu slider groove
  language).
- `.msg` — validation message line below the well. **Reserved height** (`min-height:
  1.25em`) so appearing/disappearing messages never shift layout. Color
  `var(--danger-color)`, `var(--text-sm)`. Carries `aria-live="polite"` (set in markup,
  not CSS).
- `:host([data-invalid]) .well` — border/ring flips to `var(--danger-color)` (neu: the
  well's focus ring color flips).
- `:host([disabled])` — opacity 0.45, `pointer-events: none` on the well.

### 2. `src/shared/controls/form-control-mixin.js`

`export const FormControlMixin = (Base) => class extends Base { ... }` providing:

- `static formAssociated = true`
- constructor: `this._internals = this.attachInternals()`
- `formResetCallback()` — calls `this._formReset()` if defined (each control restores its
  default from attributes and re-syncs), else no-op.
- `formDisabledCallback(disabled)` — reflects to a `data-form-disabled` attr and calls
  `_sync()` if present; controls treat it like `disabled`.
- `_setFormValue(v)` — passthrough to `this._internals.setFormValue(v)`.
- `_mirrorValidity(input)` — copies `input.validity` + `input.validationMessage` into
  `this._internals.setValidity(flags, message, input)`; when valid calls
  `setValidity({})`. Used by field/textarea (select and checkbox compute their own
  `valueMissing`).

New controls use the mixin: `class AxField extends FormControlMixin(BaseComponent)`.
Keep it under ~40 lines — it is plumbing, not a framework.

## Control contracts

Shared conventions (all five): composed `change` CustomEvent with `detail` on every
user-committed change; `label` attr renders the VISIBLE label (not just aria — form fields
need visible labels; this differs deliberately from ax-toggle's aria-only label);
`surface="neu"` opt-in variant; `name` attr platform-read (⚑); ARIA on the focusable
inner element, never host internals; 44px minimum touch targets on interactive parts;
`disabled` observed.

### ax-field  ⚑

Single-line text entry wrapping a real shadow `<input part="input">`.

- **Attrs observed:** `value`, `label`, `placeholder`, `disabled`, `required`, `error`
- **Attrs construction-time (†):** `type` (text|email|password|number|search; default
  text), `minlength`, `maxlength`, `autocomplete`, `name`
- **Property:** `value` get/set proxies the inner input's live value (attribute = default
  value, native semantics; `formResetCallback` restores from attribute). `error` get/set
  proxies `setCustomValidity` — the migration hook for custom rules like nospam.
- **Markup:** label line, then `.well` containing `<slot name="prefix">`, the input,
  `<slot name="suffix">` (icon slots, 18px svg sizing like ax-slider's icon slot), then
  `.msg` line.
- **Events:** ax-slider convention — swallow the native events at the shadow boundary and
  re-emit composed `CustomEvent('input')` / `CustomEvent('change')` with
  `detail: { value }`.
- **Validation:** on every input, `_mirrorValidity(input)`. The `.msg` line and
  `data-invalid` host attr only show after the field is *touched* (first blur with
  content-or-required, or after `reportValidity()`/form submit) — no red on first paint.
  Once touched, message updates live. `error` attr/property (custom validity) shows
  immediately when set.
- **A11y:** `<label>` wired to the input via `for`/`id` inside the shadow; `.msg` gets
  `id` + input `aria-describedby`; `aria-invalid` mirrored on the input.

### ax-textarea  ⚑

Same chrome and contract as ax-field, minus `type`/prefix/suffix, plus:

- **Attrs (†):** `rows` (default 3), `max-rows` (default 8)
- **Auto-grow:** `field-sizing: content` behind `@supports`, with a JS fallback (on
  input: reset height, set to `scrollHeight` capped at max-rows line-height product).
  Growth animates nothing (height snaps — animating typing height is noise).

### ax-select  ⚑

Single-select dropdown; we own the open menu (approved: OS-native popup would break the
tier the moment it opens).

- **Attrs observed:** `value`, `label`, `placeholder` (closed-state text when no value),
  `disabled`, `required`
- **Data:** `options` JSON attr `'[{"value":"sport","label":"Sport"}, ...]'` with
  property-wins `options` property (`_propSet` pattern, ax-ring/ax-barchart precedent).
  Malformed JSON → empty list + `log.warn`, never a throw.
- **Markup:** label line; `.well` as a `<button part="trigger">` row (selected label or
  placeholder, chevron that rotates open/closed with motion tokens); the menu is an
  absolutely-positioned `.menu` panel inside the shadow below the well (`role="listbox"`,
  option rows `role="option"` with `aria-selected`), styled `var(--neu-face)` raised +
  `var(--neu-raised)` shadow in BOTH base and neu contexts (an opaque menu is correct on
  glass too — ax-popover neu precedent); `.msg` line.
- **Open/close:** trigger `aria-haspopup="listbox"` + `aria-expanded`; opens on click,
  Enter, Space, ArrowDown/ArrowUp (opening via arrows moves active to first/last).
  Scale+fade entrance from the trigger using `--duration-fast` / `--ease-out-soft`.
  **Flip-up** when the viewport has less room below than menu height (ax-popover
  `!important` repositioning precedent). Closes on selection, Escape (returns focus to
  trigger, no change), outside pointerdown, and focusout.
- **Keyboard (open):** ArrowUp/Down move the active option (`aria-activedescendant` on
  the listbox — focus stays on the trigger), Home/End jump, type-ahead accumulates
  printable chars with a 500ms reset window (**plain interaction constant** + comment,
  NOT motionMs — input cadence, stepper precedent), Enter/Space select, Tab closes and
  moves on.
- **Selection:** sets `value` attr, `setFormValue(value)`, closes, emits `change` with
  `detail: { value, label }`. `required` + empty → `setValidity({ valueMissing: true },
  'Please select an option', trigger)`; touched model same as ax-field.
- **Option rows:** min-height 44px, active row `var(--neu-face-pressed)` inset, selected
  row shows an accent tick (`--accent-glow` — control value indicator, contract-legal).

### ax-checkbox  ⚑

Boolean check tile (distinct from ax-toggle's switch: toggle = live setting that applies
immediately; checkbox = form choice submitted later).

- **Attrs observed:** `checked`, `disabled`, `label`, `value` (form value when checked,
  default `"on"`, native parity)
- **Markup:** focusable tile `<div role="checkbox" tabindex="0" part="box">` (24px, neu
  raised face → pressed well + drawn accent checkmark when checked; base look: input-bg
  bordered box → primary fill + white check) with the visible `label` text beside it in
  `var(--color-foreground)`; clicking text toggles too. Check stroke draws with
  `--duration-fast` (progress-ring `--check-len` technique).
- **Behavior:** click/Space toggles (native checkboxes toggle on Space, not Enter);
  `aria-checked` on the tile; emits `change` with `detail: { checked }`;
  `setFormValue(checked ? value : null)`. `formResetCallback` restores the `checked`
  ATTRIBUTE's presence as default.

### ax-segment  ⚑

Single-select segmented button group (the dock-pill look, form-ready).

- **Attrs observed:** `options` (comma list, dipswitch `switches` precedent:
  `options="Comfort,Sport,Off-Road"`), `value` (selected label; defaults to first),
  `label`, `disabled`
- **Markup:** `role="radiogroup"` (aria-label from `label`) containing equal-width
  `role="radio"` buttons over a carved `var(--neu-well)` rail (base: `--control-track`);
  a raised `var(--neu-face)` + `var(--neu-raised-sm)` puck slides under the active
  segment via `transform: translateX(index * 100%)` with `--duration-base`
  `--ease-spring` (dock active-pill language). Active segment text
  `var(--color-foreground)`; inactive `var(--color-muted)`.
- **Keyboard:** roving tabindex; ArrowLeft/Right (and Up/Down) move AND select (native
  radio behavior); Home/End jump.
- **Selection:** emits `change` with `detail: { value, index }`; `setFormValue(value)`.
- Segments are equal-width (grid `1fr` per option) — simplest correct puck math; text
  truncates with ellipsis rather than resizing segments.

## Contact migration

`src/features/contact/contact.js` rebuilt on the new controls; `contact.css` keeps the
page layout (container, glass-card form shell, actions row) and drops input styling.

- Form markup: `ax-field` (Name: required, minlength 2), `ax-field` (Email: type=email,
  required), `ax-textarea` (Message: required, minlength 10), submit via
  `<ax-button variant="fill" tone="primary">` (its `loading` attr replaces the
  `.loading` class dance).
- **Keep** `static delegatesFocus = false` on contact-ui WITH its existing comment
  (router focus behavior) — ax-field hosts still delegate internally, so focusing a
  field host reaches its input.
- **nospam rule:** an `input` listener on the message field sets
  `field.error = value.toLowerCase().includes('spam') ? 'No spam allowed!' : ''` — the
  custom-validity hook replaces `FormValidator.registerRule`.
- **Submit:** `e.preventDefault()`; `form.checkValidity()` — formAssociated hosts report
  through the form. On fail: mark all fields touched (each control exposes
  `reportValidity()` which sets touched + shows message), focus
  `form.querySelector(':invalid')` (formAssociated hosts match `:invalid`). On pass:
  keep the simulated 1500ms send with AbortController, then `state.notify(...)`,
  `form.reset()` (controls restore via `formResetCallback` — no manual `resetState`
  loop), re-enable button.
- **Fix in passing:** the current success call `state.notify('Success', 'Message sent
  successfully!', 4000)` has the args swapped (signature is `notify(message, type,
  duration)`), so today it renders "Success" with an invalid type. Migration writes
  `state.notify('Message sent successfully!', 'success', 4000)`.
- **Delete after migration:** `src/shared/custom-input.js`, `src/shared/form-validator.js`,
  `src/shared/styles/forms.css`. Gate: `grep -rn` each name across `src/` returns only
  the files themselves before deletion; build guard confirms no dangling imports.

## Showcase (/components)

New `neu-form-panel` inside the existing `.neu-stage` (fourth panel), all controls
`surface="neu"`:

- `ax-field` label="Callsign" placeholder="CYBR-01" with a suffix icon slot
- `ax-select` label="Drive mode" options Comfort/Sport/Off-Road, value="sport"
- `ax-segment` options="Eco,Normal,Boost" label="Power profile"
- `ax-checkbox` label="Telemetry uplink" checked
- `ax-textarea` label="Mission notes" placeholder="Type here…" rows="2"
- A `token-note` readout line that reflects the latest `change` detail (proves the
  event contract live), wired in `_wire()` like the existing power-panel wiring.

The glass tier needs no new demo section — /contact IS the base-surface demo.

## Docs, manifest, gates

- **CONTROLS.md:** five new rows (all ⚑; † markers per contracts above); one line in the
  intro noting ax-toggle vs ax-checkbox semantics (setting vs form choice) and that
  custom-input is gone.
- **MANIFEST.toml:** new capability `neu-form-control-set` (field/textarea/select/
  checkbox/segment, formAssociated, custom listbox, contact migrated off custom-input).
- **Gates:** `npm run lint:motion` (type-ahead 500ms and any other cadence constants are
  plain + commented), `npm run build`, `npm run test:tools` all green; CONTROLS.md has
  23 control rows (18 + 5; `field-chrome.js` and `form-control-mixin.js` are shared
  modules, not controls — no rows).
- **Controller browser milestone (before merge):** tab order through the showcase form;
  select full keyboard pass (arrows/Home/End/type-ahead/Escape/flip-up near viewport
  bottom); checkbox Space toggle; segment arrow-select + puck motion; contact submit
  fail → messages appear with no layout jump → fix → success toast → form.reset clears;
  both themes; reduced-motion (puck/menu snap, no transition waits hang).

## Risks / adjudications

- **Custom listbox a11y** is the big surface — mitigated by aria-activedescendant
  pattern (focus never leaves the trigger, simplest correct model), 1:1 keyboard spec
  above, and the browser milestone as the gate.
- **Focus-ring exception:** field wells show their ring on pointer focus (focus-within
  chrome, deliberate — carets need visible context); this does NOT violate the
  data-modality invariant, which governs `:focus-visible` outlines only. CONTROLS.md
  notes it.
- **`:invalid` styling timing:** hosts match `:invalid` from first paint (required+empty);
  visible red is gated by the touched model inside the control — page CSS must not style
  `ax-*:invalid` directly. CONTROLS.md notes it.
