# Neu Form Controls — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five form controls (ax-field, ax-textarea, ax-select, ax-checkbox, ax-segment) joining the ax-* fleet, plus contact-page migration off the legacy custom-input stack.

**Architecture:** Each control is a single file in `src/shared/controls/` extending `FormControlMixin(BaseComponent)`; field/textarea/select share `FIELD_CHROME_CSS` (label/well/message chrome). Validation = the platform Constraint Validation API mirrored through ElementInternals with a "touched" display model. Spec: `docs/superpowers/specs/2026-07-21-neu-form-controls-design.md`.

**Tech Stack:** Vanilla ES modules, Web Components (Shadow DOM), zero dependencies.

## Global Constraints

- No literal easings/durations in CSS — motion tokens (`var(--duration-*)`, `var(--ease-*)`) only; `npm run lint:motion` must stay clean. JS interaction cadences (type-ahead 500ms) are PLAIN constants with a comment (stepper precedent), never `motionMs()`.
- ARIA on the FOCUSABLE inner element, never host internals for interactive state.
- Composed `CustomEvent('change')` with `detail` on every user-committed change; ax-field/ax-textarea also emit `CustomEvent('input')` and SWALLOW the native events at the boundary (`e.stopPropagation()`, ax-slider precedent).
- Absent numeric/string attribute ≠ empty/zero — `getAttribute() === null` checks (Number(null)===0 trap).
- `label` attr renders the VISIBLE label on these five controls (deliberate difference from ax-toggle's aria-only label).
- Touched model: no validation message before first blur / `reportValidity()`; `.msg` line has reserved height (`min-height: 1.25em`) so messages never shift layout.
- 44px minimum touch targets on interactive parts.
- This repo has no unit-test harness for shadow controls; the test cycle per task = `node --check` on every touched file + `npm run lint:motion`, and the controller runs live-browser milestones after Tasks 6, 7, and 8. Final gates: `npm run build` + `npm run test:tools`.
- Commit per task with the given message. No push, no deploy (PUSH IS HELD on this repo).

---

### Task 1: Shared modules — FormControlMixin + FIELD_CHROME_CSS

**Files:**
- Create: `src/shared/controls/form-control-mixin.js`
- Create: `src/shared/controls/field-chrome.js`

**Interfaces:**
- Produces: `FormControlMixin(Base)` — class factory adding `static formAssociated`, `this._internals`, `formResetCallback()` (calls `this._formReset()` if defined), `formDisabledCallback(disabled)` (reflects `data-form-disabled` attr, calls `this._sync()` if defined), `_setFormValue(v)`, `_mirrorValidity(input)`.
- Produces: `FIELD_CHROME_CSS` — CSS string with classes `.control-label`, `.well`, `.msg`, host states `[data-invalid]`, `[disabled]`/`[data-form-disabled]`, `[surface="neu"]`.

- [ ] **Step 1: Write `src/shared/controls/form-control-mixin.js`:**

```js
/**
 * FormControlMixin — ElementInternals plumbing shared by form controls.
 * Adds formAssociated, reset/disabled lifecycle, and validity mirroring.
 * Controls may implement _formReset() (restore defaults from attributes)
 * and _sync() (re-render state); both hooks are optional.
 */
const VALIDITY_FLAGS = [
  'valueMissing', 'typeMismatch', 'patternMismatch', 'tooLong', 'tooShort',
  'rangeUnderflow', 'rangeOverflow', 'stepMismatch', 'badInput', 'customError'
];

export const FormControlMixin = (Base) => class extends Base {
  static formAssociated = true;

  constructor() {
    super();
    this._internals = this.attachInternals();
  }

  formResetCallback() {
    if (this._formReset) this._formReset();
  }

  formDisabledCallback(disabled) {
    this.toggleAttribute('data-form-disabled', disabled);
    if (this._sync) this._sync();
  }

  _setFormValue(v) {
    this._internals.setFormValue(v);
  }

  /** Mirror a native inner input's validity onto the host's internals. */
  _mirrorValidity(input) {
    if (input.validity.valid) {
      this._internals.setValidity({});
      return;
    }
    const flags = {};
    for (const f of VALIDITY_FLAGS) {
      if (input.validity[f]) flags[f] = true;
    }
    this._internals.setValidity(flags, input.validationMessage, input);
  }
};
```

- [ ] **Step 2: Write `src/shared/controls/field-chrome.js`:**

```js
/**
 * FIELD_CHROME_CSS — shared label/well/message chrome for ax-field,
 * ax-textarea, ax-select. The base look mirrors theme.css's global inputs
 * (shadow fields match light-DOM forms pixel-for-pixel); surface="neu"
 * carves the well. The focus ring is focus-within chrome ON PURPOSE:
 * text entry shows its ring for pointer focus too (caret needs visible
 * context) — this is outside the data-modality :focus-visible system.
 */
export const FIELD_CHROME_CSS = `
  :host { display: block; }
  :host([disabled]) .well, :host([data-form-disabled]) .well,
  :host([disabled]) .control-label, :host([data-form-disabled]) .control-label {
    opacity: 0.45;
  }
  :host([disabled]) .well, :host([data-form-disabled]) .well { pointer-events: none; }
  .control-label {
    display: block;
    font-size: var(--text-sm); font-weight: 600;
    color: var(--color-muted);
    margin-bottom: var(--space-xs);
    letter-spacing: 0.05em; text-transform: uppercase;
  }
  .control-label:empty { display: none; }
  .well {
    display: flex; align-items: center; gap: var(--space-xs);
    width: 100%; box-sizing: border-box;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: 12px;
    padding: 0 var(--space-m);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
    transition:
      background var(--duration-base) var(--ease-out-soft),
      border-color var(--duration-base) var(--ease-out-soft),
      box-shadow var(--duration-base) var(--ease-out-soft);
  }
  .well:focus-within {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--color-primary);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 0 4px rgba(59, 130, 246, 0.1);
  }
  :host([data-invalid]) .well { border-color: var(--danger-color); }
  :host([data-invalid]) .well:focus-within {
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1),
      0 0 0 4px color-mix(in srgb, var(--danger-color) 15%, transparent);
  }
  .msg {
    min-height: 1.25em;
    margin: var(--space-2xs) 0 0;
    font-size: var(--text-sm);
    color: var(--danger-color);
  }
  /* ===== surface="neu" — carved well ===== */
  :host([surface="neu"]) .well {
    background: var(--neu-surface-deep);
    border: none;
    box-shadow: var(--neu-well);
  }
  :host([surface="neu"]) .well:focus-within {
    box-shadow: var(--neu-well), 0 0 0 1px var(--color-primary);
  }
  :host([surface="neu"][data-invalid]) .well {
    box-shadow: var(--neu-well), 0 0 0 1px var(--danger-color);
  }
`;
```

- [ ] **Step 3: Verify.** Run: `node --check src/shared/controls/form-control-mixin.js && node --check src/shared/controls/field-chrome.js && npm run lint:motion` — expect no output errors and "Motion gate clean".

- [ ] **Step 4: Commit**

```bash
git add src/shared/controls/form-control-mixin.js src/shared/controls/field-chrome.js
git commit -m "feat(forms): FormControlMixin + shared field chrome — the plumbing for the form-control set"
```

---

### Task 2: ax-field

**Files:**
- Create: `src/shared/controls/ax-field.js`

**Interfaces:**
- Consumes: `FormControlMixin`, `FIELD_CHROME_CSS` from Task 1.
- Produces: `<ax-field>` — observed `value,label,placeholder,disabled,required,error`; construction-time `type,minlength,maxlength,autocomplete,name`; properties `value` (live), `error` (custom validity); method `reportValidity()`; events `input`/`change` (`detail: { value }`); slots `prefix`/`suffix`.

- [ ] **Step 1: Write `src/shared/controls/ax-field.js`:**

```js
/**
 * <ax-field label="Name" type="email" required> — single-line text entry.
 * Wraps a real shadow <input>; swallows native input/change at the boundary
 * and re-emits composed CustomEvents with detail.value (ax-slider precedent).
 * Validity mirrors onto the host via ElementInternals; the message line and
 * data-invalid only show after the field is "touched" (first blur or
 * reportValidity()) — custom errors set via `error` show immediately.
 */
import { BaseComponent } from '@shared/base-component.js';
import { FormControlMixin } from './form-control-mixin.js';
import { FIELD_CHROME_CSS } from './field-chrome.js';

const TYPES = ['text', 'email', 'password', 'number', 'search'];

const CSS = FIELD_CHROME_CSS + `
  input {
    background: transparent; border: none; outline: none;
    flex: 1; min-width: 0; min-height: 44px;
    padding: 0;
    color: var(--color-foreground);
    font: inherit; font-size: var(--text-base);
  }
  input::placeholder { color: var(--input-placeholder); opacity: 1; }
  ::slotted(svg) { width: 18px; height: 18px; color: var(--color-muted); flex-shrink: 0; }
`;

export class AxField extends FormControlMixin(BaseComponent) {
  static observedAttributes = ['value', 'label', 'placeholder', 'disabled', 'required', 'error'];

  constructor() {
    super();
    this.addStyles(CSS);
  }

  get value() { return this._input ? this._input.value : (this.getAttribute('value') || ''); }
  set value(v) {
    if (this._input) { this._input.value = v ?? ''; this._syncValidity(); }
    else this.setAttribute('value', v ?? '');
  }

  get error() { return this._error || ''; }
  set error(msg) {
    this._error = msg || '';
    if (!this._input) return;
    this._input.setCustomValidity(this._error);
    if (this._error) this._touched = true; // custom errors show immediately
    this._syncValidity();
  }

  attributeChangedCallback(name) {
    if (!this._input) return;
    if (name === 'value') { this._input.value = this.getAttribute('value') || ''; this._syncValidity(); }
    else if (name === 'error') this.error = this.getAttribute('error') || '';
    else this._sync();
  }

  render() {
    const typeAttr = this.getAttribute('type');
    const type = TYPES.includes(typeAttr) ? typeAttr : 'text';
    const id = `f-${Math.random().toString(36).slice(2, 9)}`;
    const min = this.getAttribute('minlength');
    const max = this.getAttribute('maxlength');
    const auto = this.getAttribute('autocomplete');
    this.shadowRoot.innerHTML = `
      <label class="control-label" for="${id}"></label>
      <div class="well" part="well">
        <slot name="prefix"></slot>
        <input id="${id}" part="input" type="${type}"
          ${min !== null ? `minlength="${this._esc(min)}"` : ''}
          ${max !== null ? `maxlength="${this._esc(max)}"` : ''}
          ${auto !== null ? `autocomplete="${this._esc(auto)}"` : ''}
          aria-describedby="${id}-msg">
        <slot name="suffix"></slot>
      </div>
      <p class="msg" id="${id}-msg" aria-live="polite"></p>`;
    this._input = this.shadowRoot.querySelector('input');
    this._msg = this.shadowRoot.querySelector('.msg');
    this._input.value = this.getAttribute('value') || '';
    this._touched = false;

    // Swallow natives, re-emit with detail (fleet event contract).
    this._input.addEventListener('input', e => {
      e.stopPropagation();
      this._syncValidity();
      this.dispatchEvent(new CustomEvent('input', {
        bubbles: true, composed: true, detail: { value: this._input.value }
      }));
    });
    this._input.addEventListener('change', e => {
      e.stopPropagation();
      this.dispatchEvent(new CustomEvent('change', {
        bubbles: true, composed: true, detail: { value: this._input.value }
      }));
    });
    this._input.addEventListener('blur', () => {
      this._touched = true;
      this._syncValidity();
    });

    if (this.getAttribute('error')) this.error = this.getAttribute('error');
    this._sync();
  }

  _sync() {
    const label = this.getAttribute('label') || '';
    this.shadowRoot.querySelector('.control-label').textContent = label;
    this._input.placeholder = this.getAttribute('placeholder') || '';
    this._input.required = this.hasAttribute('required');
    this._input.disabled = this.hasAttribute('disabled') || this.hasAttribute('data-form-disabled');
    if (!label) this._input.setAttribute('aria-label', this.getAttribute('placeholder') || 'Text field');
    else this._input.removeAttribute('aria-label');
    this._syncValidity();
  }

  _syncValidity() {
    this._setFormValue(this._input.value);
    this._mirrorValidity(this._input);
    const show = this._touched && !this._input.validity.valid;
    this.toggleAttribute('data-invalid', show);
    this._input.setAttribute('aria-invalid', String(show));
    this._msg.textContent = show ? this._input.validationMessage : '';
  }

  reportValidity() {
    this._touched = true;
    this._syncValidity();
    return this._input.validity.valid;
  }

  _formReset() {
    this._input.value = this.getAttribute('value') || '';
    this._touched = false;
    this._error = '';
    this._input.setCustomValidity('');
    this._syncValidity();
  }
}

customElements.define('ax-field', AxField);
```

- [ ] **Step 2: Verify.** Run: `node --check src/shared/controls/ax-field.js && npm run lint:motion`

- [ ] **Step 3: Commit**

```bash
git add src/shared/controls/ax-field.js
git commit -m "feat(forms): ax-field — text entry with mirrored validity and touched-model messages"
```

---

### Task 3: ax-textarea

**Files:**
- Create: `src/shared/controls/ax-textarea.js`

**Interfaces:**
- Consumes: `FormControlMixin`, `FIELD_CHROME_CSS` (Task 1).
- Produces: `<ax-textarea>` — same contract as ax-field minus `type` and prefix/suffix slots; construction-time `rows` (default 3), `max-rows` (default 8); auto-grows.

- [ ] **Step 1: Write `src/shared/controls/ax-textarea.js`:**

```js
/**
 * <ax-textarea label="Message" required minlength="10" rows="3" max-rows="8">
 * Multi-line ax-field: same chrome, same touched-model validity, auto-grows
 * to max-rows (field-sizing: content where supported, JS fallback elsewhere).
 * Height growth deliberately does not animate — animating typing is noise.
 */
import { BaseComponent } from '@shared/base-component.js';
import { FormControlMixin } from './form-control-mixin.js';
import { FIELD_CHROME_CSS } from './field-chrome.js';

const SUPPORTS_FIELD_SIZING =
  typeof window !== 'undefined' && window.CSS?.supports?.('field-sizing', 'content');

const CSS = FIELD_CHROME_CSS + `
  textarea {
    background: transparent; border: none; outline: none;
    flex: 1; min-width: 0; resize: none;
    padding: var(--space-s) 0;
    color: var(--color-foreground);
    font: inherit; font-size: var(--text-base);
    line-height: 1.5;
  }
  textarea::placeholder { color: var(--input-placeholder); opacity: 1; }
  @supports (field-sizing: content) {
    textarea { field-sizing: content; }
  }
`;

export class AxTextarea extends FormControlMixin(BaseComponent) {
  static observedAttributes = ['value', 'label', 'placeholder', 'disabled', 'required', 'error'];

  constructor() {
    super();
    this.addStyles(CSS);
  }

  get value() { return this._input ? this._input.value : (this.getAttribute('value') || ''); }
  set value(v) {
    if (this._input) { this._input.value = v ?? ''; this._syncValidity(); this._grow(); }
    else this.setAttribute('value', v ?? '');
  }

  get error() { return this._error || ''; }
  set error(msg) {
    this._error = msg || '';
    if (!this._input) return;
    this._input.setCustomValidity(this._error);
    if (this._error) this._touched = true; // custom errors show immediately
    this._syncValidity();
  }

  attributeChangedCallback(name) {
    if (!this._input) return;
    if (name === 'value') { this._input.value = this.getAttribute('value') || ''; this._syncValidity(); this._grow(); }
    else if (name === 'error') this.error = this.getAttribute('error') || '';
    else this._sync();
  }

  render() {
    const id = `t-${Math.random().toString(36).slice(2, 9)}`;
    const rowsAttr = this.getAttribute('rows');
    const rows = rowsAttr === null ? 3 : Math.max(1, Number(rowsAttr) || 3);
    const maxAttr = this.getAttribute('max-rows');
    this._maxRows = maxAttr === null ? 8 : Math.max(rows, Number(maxAttr) || 8);
    const min = this.getAttribute('minlength');
    const max = this.getAttribute('maxlength');
    this.shadowRoot.innerHTML = `
      <label class="control-label" for="${id}"></label>
      <div class="well" part="well">
        <textarea id="${id}" part="input" rows="${rows}"
          ${min !== null ? `minlength="${this._esc(min)}"` : ''}
          ${max !== null ? `maxlength="${this._esc(max)}"` : ''}
          aria-describedby="${id}-msg"></textarea>
      </div>
      <p class="msg" id="${id}-msg" aria-live="polite"></p>`;
    this._input = this.shadowRoot.querySelector('textarea');
    this._msg = this.shadowRoot.querySelector('.msg');
    // Cap growth at max-rows (1.5 = the line-height set in CSS above).
    this._input.style.maxHeight = `${this._maxRows * 1.5}em`;
    this._input.value = this.getAttribute('value') || '';
    this._touched = false;

    this._input.addEventListener('input', e => {
      e.stopPropagation();
      this._grow();
      this._syncValidity();
      this.dispatchEvent(new CustomEvent('input', {
        bubbles: true, composed: true, detail: { value: this._input.value }
      }));
    });
    this._input.addEventListener('change', e => {
      e.stopPropagation();
      this.dispatchEvent(new CustomEvent('change', {
        bubbles: true, composed: true, detail: { value: this._input.value }
      }));
    });
    this._input.addEventListener('blur', () => {
      this._touched = true;
      this._syncValidity();
    });

    if (this.getAttribute('error')) this.error = this.getAttribute('error');
    this._sync();
    this._grow();
  }

  _grow() {
    if (SUPPORTS_FIELD_SIZING) return; // CSS handles it
    this._input.style.height = 'auto';
    this._input.style.height = `${this._input.scrollHeight}px`; // maxHeight caps it
  }

  _sync() {
    const label = this.getAttribute('label') || '';
    this.shadowRoot.querySelector('.control-label').textContent = label;
    this._input.placeholder = this.getAttribute('placeholder') || '';
    this._input.required = this.hasAttribute('required');
    this._input.disabled = this.hasAttribute('disabled') || this.hasAttribute('data-form-disabled');
    if (!label) this._input.setAttribute('aria-label', this.getAttribute('placeholder') || 'Text area');
    else this._input.removeAttribute('aria-label');
    this._syncValidity();
  }

  _syncValidity() {
    this._setFormValue(this._input.value);
    this._mirrorValidity(this._input);
    const show = this._touched && !this._input.validity.valid;
    this.toggleAttribute('data-invalid', show);
    this._input.setAttribute('aria-invalid', String(show));
    this._msg.textContent = show ? this._input.validationMessage : '';
  }

  reportValidity() {
    this._touched = true;
    this._syncValidity();
    return this._input.validity.valid;
  }

  _formReset() {
    this._input.value = this.getAttribute('value') || '';
    this._touched = false;
    this._error = '';
    this._input.setCustomValidity('');
    this._syncValidity();
    this._grow();
  }
}

customElements.define('ax-textarea', AxTextarea);
```

- [ ] **Step 2: Verify.** Run: `node --check src/shared/controls/ax-textarea.js && npm run lint:motion`

- [ ] **Step 3: Commit**

```bash
git add src/shared/controls/ax-textarea.js
git commit -m "feat(forms): ax-textarea — auto-growing multi-line field, field-sizing with JS fallback"
```

---

### Task 4: ax-select

**Files:**
- Create: `src/shared/controls/ax-select.js`

**Interfaces:**
- Consumes: `FormControlMixin`, `FIELD_CHROME_CSS` (Task 1).
- Produces: `<ax-select>` — observed `value,label,placeholder,disabled,required,options`; property `options` (array of `{value,label}`, property-wins); method `reportValidity()`; event `change` (`detail: { value, label }`).

- [ ] **Step 1: Write `src/shared/controls/ax-select.js`:**

```js
/**
 * <ax-select label="Drive mode" options='[{"value":"s","label":"Sport"}]' value="s">
 * Single-select dropdown. We OWN the open menu — the OS-native popup would
 * shatter the neu tier the moment it opens. ARIA select-only combobox:
 * focus NEVER leaves the trigger (aria-activedescendant tracks the active
 * option), which keeps the keyboard model simple and correct.
 * Type-ahead reset is a PLAIN interaction constant (input cadence, not a
 * transition wait — stepper precedent).
 */
import { BaseComponent } from '@shared/base-component.js';
import { FormControlMixin } from './form-control-mixin.js';
import { FIELD_CHROME_CSS } from './field-chrome.js';
import { log } from '@core/logger.js';

const TYPEAHEAD_RESET_MS = 500;

const CSS = FIELD_CHROME_CSS + `
  .anchor { position: relative; }
  .well { padding: 0; }
  .trigger {
    all: unset; box-sizing: border-box;
    display: flex; align-items: center; gap: var(--space-xs);
    width: 100%; min-height: 44px;
    padding: 0 var(--space-m);
    cursor: pointer;
    color: var(--color-foreground);
    font: inherit; font-size: var(--text-base);
  }
  .sel.placeholder { color: var(--input-placeholder); }
  .chevron {
    margin-left: auto; flex-shrink: 0;
    width: 16px; height: 16px; color: var(--color-muted);
    transition: transform var(--duration-fast) var(--ease-out-soft);
  }
  :host([open]) .chevron { transform: rotate(180deg); }
  .menu {
    position: absolute; z-index: 101; left: 0; right: 0;
    top: calc(100% + var(--space-2xs));
    margin: 0; padding: var(--space-2xs); list-style: none;
    background: var(--neu-face);
    border-radius: 12px;
    box-shadow: var(--neu-raised), 0 14px 28px var(--neu-dark);
    max-height: 280px; overflow-y: auto;
    display: none; opacity: 0;
    transform: scale(0.96) translateY(-4px);
    transform-origin: top center;
    transition: opacity var(--duration-fast) var(--ease-out-soft),
      transform var(--duration-fast) var(--ease-out-soft),
      display var(--duration-fast) allow-discrete;
  }
  :host([open]) .menu { display: block; opacity: 1; transform: none; }
  @starting-style {
    :host([open]) .menu { opacity: 0; transform: scale(0.96) translateY(-4px); }
  }
  :host([data-flip]) .menu {
    top: auto; bottom: calc(100% + var(--space-2xs));
    transform: scale(0.96) translateY(4px);
    transform-origin: bottom center;
  }
  :host([data-flip][open]) .menu { transform: none; }
  @starting-style {
    :host([data-flip][open]) .menu { opacity: 0; transform: scale(0.96) translateY(4px); }
  }
  .option {
    display: flex; align-items: center; gap: var(--space-s);
    min-height: 44px; padding: 0 var(--space-s);
    border-radius: 8px; cursor: pointer;
    color: var(--color-foreground);
  }
  .option:hover, .option[data-active] { background: var(--neu-face-pressed); }
  .option .tick {
    margin-left: auto; flex-shrink: 0;
    width: 14px; height: 14px;
    color: var(--accent-glow); /* control value indicator — contract-legal */
    opacity: 0;
    transition: opacity var(--duration-fast) var(--ease-out-soft);
  }
  .option[aria-selected="true"] .tick { opacity: 1; }
`;

export class AxSelect extends FormControlMixin(BaseComponent) {
  static observedAttributes = ['value', 'label', 'placeholder', 'disabled', 'required', 'options'];

  constructor() {
    super();
    this.addStyles(CSS);
    this._options = [];
    this._active = 0;
    this._onDocPointerDown = (e) => {
      if (e.composedPath().includes(this)) return;
      this._close(false);
    };
  }

  get options() { return this._options; }
  set options(list) {
    this._propSet = true; // explicit property assignment permanently wins over the attribute
    this._options = Array.isArray(list) ? list : [];
    if (this._trigger) this._renderOptions();
  }

  get value() { return this.getAttribute('value') || ''; }
  set value(v) { this.setAttribute('value', v ?? ''); }

  attributeChangedCallback(name) {
    if (!this._trigger) return;
    if (name === 'options') { if (!this._propSet) this._parseAttr(); }
    else this._sync();
  }

  _parseAttr() {
    try {
      const parsed = JSON.parse(this.getAttribute('options') || '[]');
      this._options = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      this._options = [];
      log.warn('[ax-select] Bad options JSON', e);
    }
    this._renderOptions();
  }

  render() {
    const id = `s-${Math.random().toString(36).slice(2, 9)}`;
    this._id = id;
    this.shadowRoot.innerHTML = `
      <label class="control-label" id="${id}-label"></label>
      <div class="anchor">
        <div class="well" part="well">
          <button type="button" class="trigger" part="trigger" role="combobox"
            aria-haspopup="listbox" aria-expanded="false"
            aria-controls="${id}-menu"
            aria-labelledby="${id}-label ${id}-value"
            aria-describedby="${id}-msg">
            <span class="sel" id="${id}-value"></span>
            <svg class="chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
        </div>
        <ul class="menu" role="listbox" id="${id}-menu" aria-labelledby="${id}-label"></ul>
      </div>
      <p class="msg" id="${id}-msg" aria-live="polite"></p>`;
    this._trigger = this.shadowRoot.querySelector('.trigger');
    this._menu = this.shadowRoot.querySelector('.menu');
    this._msg = this.shadowRoot.querySelector('.msg');
    this._touched = false;
    this._defaultValue = this.getAttribute('value'); // for form reset

    this._trigger.addEventListener('click', () => {
      this.hasAttribute('open') ? this._close() : this._open();
    });
    this._trigger.addEventListener('keydown', e => this._onKeydown(e));
    // Keep focus ON the trigger while clicking options (listbox convention);
    // this also keeps :focus-within chrome stable during mouse selection.
    this._menu.addEventListener('pointerdown', e => e.preventDefault());
    this._menu.addEventListener('click', e => {
      const li = e.target.closest('.option');
      if (li) this._select(Number(li.dataset.i));
    });
    // Touched when focus truly leaves the component (not trigger→menu hops).
    this.addEventListener('focusout', () => {
      queueMicrotask(() => {
        if (this.matches(':focus-within')) return;
        if (this.hasAttribute('open')) this._close(false);
        this._touched = true;
        this._syncValidity();
      });
    });

    if (this._propSet) this._renderOptions();
    else this._parseAttr();
  }

  _onKeydown(e) {
    const open = this.hasAttribute('open');
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        this._open();
      }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); this._setActive(this._active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this._setActive(this._active - 1); }
    else if (e.key === 'Home') { e.preventDefault(); this._setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); this._setActive(this._options.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._select(this._active); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this._close(); }
    else if (e.key === 'Tab') { this._close(false); }
    else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) { this._typeahead(e.key); }
  }

  _typeahead(char) {
    clearTimeout(this._taTimer);
    this._taBuf = (this._taBuf || '') + char.toLowerCase();
    this._taTimer = setTimeout(() => { this._taBuf = ''; }, TYPEAHEAD_RESET_MS);
    const i = this._options.findIndex(o =>
      String(o.label ?? o.value).toLowerCase().startsWith(this._taBuf));
    if (i !== -1) this._setActive(i);
  }

  _open() {
    if (this.hasAttribute('open') || this._trigger.disabled) return;
    this.setAttribute('open', '');
    this._trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', this._onDocPointerDown, true);
    const sel = this._options.findIndex(o => String(o.value) === this.value);
    this._setActive(sel === -1 ? 0 : sel);
    requestAnimationFrame(() => {
      // Flip up when there is less room below the well than the menu needs
      // (ax-popover flip precedent; shadow-internal, so no !important dance).
      const wellRect = this.shadowRoot.querySelector('.well').getBoundingClientRect();
      const menuH = this._menu.offsetHeight;
      const below = window.innerHeight - wellRect.bottom;
      if (below < menuH + 16 && wellRect.top > menuH + 16) this.setAttribute('data-flip', '');
    });
  }

  _close(refocus = true) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.removeAttribute('data-flip');
    this._trigger.setAttribute('aria-expanded', 'false');
    this._trigger.removeAttribute('aria-activedescendant');
    document.removeEventListener('pointerdown', this._onDocPointerDown, true);
    this._touched = true;
    this._syncValidity();
    if (refocus) this._trigger.focus();
  }

  _select(i) {
    const o = this._options[i];
    if (!o) return;
    const next = String(o.value);
    const changed = next !== this.value;
    this.setAttribute('value', next);
    this._close();
    if (changed) {
      this.dispatchEvent(new CustomEvent('change', {
        bubbles: true, composed: true,
        detail: { value: next, label: String(o.label ?? o.value) }
      }));
    }
  }

  _setActive(i) {
    const n = this._options.length;
    if (!n) return;
    this._active = Math.max(0, Math.min(n - 1, i));
    this._menu.querySelectorAll('.option').forEach((el, j) => {
      if (j === this._active) el.setAttribute('data-active', '');
      else el.removeAttribute('data-active');
    });
    this._trigger.setAttribute('aria-activedescendant', `${this._id}-opt-${this._active}`);
    this._menu.children[this._active]?.scrollIntoView({ block: 'nearest' });
  }

  _renderOptions() {
    this._menu.innerHTML = this._options.map((o, i) => `
      <li class="option" id="${this._id}-opt-${i}" role="option" data-i="${i}">
        <span>${this._esc(o.label ?? o.value)}</span>
        <svg class="tick" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </li>`).join('');
    this._sync();
  }

  _sync() {
    this.shadowRoot.querySelector('.control-label').textContent = this.getAttribute('label') || '';
    this._trigger.disabled = this.hasAttribute('disabled') || this.hasAttribute('data-form-disabled');
    const selected = this._options.find(o => String(o.value) === this.value);
    const sel = this.shadowRoot.querySelector('.sel');
    sel.textContent = selected ? String(selected.label ?? selected.value)
      : (this.getAttribute('placeholder') || 'Select…');
    sel.classList.toggle('placeholder', !selected);
    this._menu.querySelectorAll('.option').forEach((el, i) => {
      el.setAttribute('aria-selected', String(String(this._options[i].value) === this.value));
    });
    this._syncValidity();
  }

  _syncValidity() {
    const selected = this._options.some(o => String(o.value) === this.value);
    this._setFormValue(selected ? this.value : null);
    if (this.hasAttribute('required') && !selected) {
      this._internals.setValidity({ valueMissing: true }, 'Please select an option', this._trigger);
    } else {
      this._internals.setValidity({});
    }
    const show = this._touched && this.hasAttribute('required') && !selected;
    this.toggleAttribute('data-invalid', show);
    this._msg.textContent = show ? 'Please select an option' : '';
  }

  reportValidity() {
    this._touched = true;
    this._syncValidity();
    return !this.hasAttribute('data-invalid');
  }

  _formReset() {
    if (this._defaultValue === null) this.removeAttribute('value');
    else this.setAttribute('value', this._defaultValue);
    this._touched = false;
    this._sync();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this._taTimer);
    document.removeEventListener('pointerdown', this._onDocPointerDown, true);
  }
}

customElements.define('ax-select', AxSelect);
```

- [ ] **Step 2: Verify.** Run: `node --check src/shared/controls/ax-select.js && npm run lint:motion`

- [ ] **Step 3: Commit**

```bash
git add src/shared/controls/ax-select.js
git commit -m "feat(forms): ax-select — owned neu listbox menu, activedescendant keyboard model, flip-up"
```

---

### Task 5: ax-checkbox

**Files:**
- Create: `src/shared/controls/ax-checkbox.js`

**Interfaces:**
- Consumes: `FormControlMixin` (Task 1). Does NOT use FIELD_CHROME_CSS (no well).
- Produces: `<ax-checkbox>` — observed `checked,disabled,label,value`; property `checked`; event `change` (`detail: { checked }`).

- [ ] **Step 1: Write `src/shared/controls/ax-checkbox.js`:**

```js
/**
 * <ax-checkbox label="Telemetry uplink" checked> — form choice tile.
 * Semantics vs ax-toggle: a TOGGLE is a live setting that applies
 * immediately; a CHECKBOX is a form choice submitted later. The label is
 * VISIBLE text (form controls need visible labels). Space toggles (native
 * checkbox parity — Enter does not).
 */
import { BaseComponent } from '@shared/base-component.js';
import { FormControlMixin } from './form-control-mixin.js';

const CSS = `
  :host { display: inline-flex; }
  :host([disabled]), :host([data-form-disabled]) { opacity: 0.45; pointer-events: none; }
  .row {
    display: inline-flex; align-items: center; gap: var(--space-s);
    min-height: 44px; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .box {
    width: 24px; height: 24px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    transition: background var(--duration-fast) var(--ease-out-soft),
      border-color var(--duration-fast) var(--ease-out-soft),
      box-shadow var(--duration-fast) var(--ease-out-soft);
  }
  .box:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .check {
    width: 14px; height: 14px; color: #fff;
    stroke-dasharray: 24; stroke-dashoffset: 24;
    transition: stroke-dashoffset var(--duration-fast) var(--ease-out-soft);
  }
  :host([checked]) .box { background: var(--color-primary); border-color: var(--color-primary); }
  :host([checked]) .check { stroke-dashoffset: 0; }
  .text { color: var(--color-foreground); font-size: var(--text-base); }
  /* ===== surface="neu" — raised tile presses into a lit well ===== */
  :host([surface="neu"]) .box {
    width: 28px; height: 28px; border-radius: 9px; border: none;
    background: var(--neu-face);
    box-shadow: var(--neu-raised-sm);
  }
  :host([surface="neu"][checked]) .box {
    background: var(--neu-surface-deep);
    box-shadow: var(--neu-well);
  }
  :host([surface="neu"]) .check {
    color: var(--accent-glow); /* control value indicator — contract-legal */
    filter: drop-shadow(0 0 4px color-mix(in srgb, var(--accent-glow) 60%, transparent));
  }
`;

export class AxCheckbox extends FormControlMixin(BaseComponent) {
  static observedAttributes = ['checked', 'disabled', 'label', 'value'];

  constructor() {
    super();
    this.addStyles(CSS);
  }

  get checked() { return this.hasAttribute('checked'); }
  set checked(v) { this.toggleAttribute('checked', Boolean(v)); }

  attributeChangedCallback() {
    if (this._box) this._sync();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <span class="row" part="row">
        <span class="box" part="box" role="checkbox" tabindex="0">
          <svg class="check" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </span>
        <span class="text" part="label"></span>
      </span>`;
    this._box = this.shadowRoot.querySelector('.box');
    this._defaultChecked = this.hasAttribute('checked'); // for form reset

    this.shadowRoot.querySelector('.row').addEventListener('click', () => this._toggle());
    this._box.addEventListener('keydown', e => {
      if (e.key === ' ') { e.preventDefault(); this._toggle(); }
    });
    this._sync();
  }

  _toggle() {
    if (this.hasAttribute('disabled') || this.hasAttribute('data-form-disabled')) return;
    this.checked = !this.checked;
    this.dispatchEvent(new CustomEvent('change', {
      bubbles: true, composed: true, detail: { checked: this.checked }
    }));
  }

  _sync() {
    const label = this.getAttribute('label') || 'Checkbox';
    this._box.setAttribute('aria-checked', String(this.checked));
    this._box.setAttribute('aria-label', label);
    this.shadowRoot.querySelector('.text').textContent = this.getAttribute('label') || '';
    this._setFormValue(this.checked ? (this.getAttribute('value') || 'on') : null);
  }

  _formReset() {
    this.checked = this._defaultChecked;
    this._sync();
  }
}

customElements.define('ax-checkbox', AxCheckbox);
```

- [ ] **Step 2: Verify.** Run: `node --check src/shared/controls/ax-checkbox.js && npm run lint:motion`

- [ ] **Step 3: Commit**

```bash
git add src/shared/controls/ax-checkbox.js
git commit -m "feat(forms): ax-checkbox — drawn-check form tile, visible label, Space-toggle parity"
```

---

### Task 6: ax-segment

**Files:**
- Create: `src/shared/controls/ax-segment.js`

**Interfaces:**
- Consumes: `FormControlMixin` (Task 1).
- Produces: `<ax-segment options="Eco,Normal,Boost" value="Normal">` — observed `options,value,label,disabled`; property `value`; event `change` (`detail: { value, index }`).

- [ ] **Step 1: Write `src/shared/controls/ax-segment.js`:**

```js
/**
 * <ax-segment options="Eco,Normal,Boost" value="Normal" label="Power profile">
 * Single-select segmented control: a raised puck slides under the active
 * segment (dock active-pill language). Radiogroup semantics — arrows MOVE
 * AND SELECT (native radio parity), roving tabindex, equal-width segments.
 * `value` is the selected option's label (comma-list options, dipswitch
 * precedent); defaults to the first option.
 */
import { BaseComponent } from '@shared/base-component.js';
import { FormControlMixin } from './form-control-mixin.js';

const CSS = `
  :host { display: inline-flex; max-width: 100%; }
  :host([disabled]), :host([data-form-disabled]) { opacity: 0.45; pointer-events: none; }
  .group {
    position: relative; isolation: isolate;
    display: grid; grid-auto-flow: column; grid-auto-columns: 1fr;
    max-width: 100%;
    border-radius: 999px; padding: 3px;
    background: var(--control-track);
  }
  .puck {
    position: absolute; z-index: -1;
    top: 3px; bottom: 3px; left: 3px;
    width: calc((100% - 6px) / var(--seg-count, 1));
    border-radius: 999px;
    background: var(--color-primary);
    transition: transform var(--duration-base) var(--ease-spring);
  }
  .seg {
    all: unset; box-sizing: border-box; cursor: pointer;
    min-height: 44px; min-width: 44px; padding: 0 var(--space-m);
    display: flex; align-items: center; justify-content: center;
    font-size: var(--text-sm); font-weight: 600;
    color: var(--color-muted);
    transition: color var(--duration-fast) var(--ease-out-soft);
    -webkit-tap-highlight-color: transparent;
  }
  .seg span {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .seg:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: 999px; }
  .seg[aria-checked="true"] { color: #fff; }
  /* ===== surface="neu" — carved rail, raised face puck ===== */
  :host([surface="neu"]) .group {
    background: var(--neu-surface-deep);
    box-shadow: var(--neu-well);
  }
  :host([surface="neu"]) .puck {
    background: var(--neu-face);
    box-shadow: var(--neu-raised-sm);
  }
  :host([surface="neu"]) .seg[aria-checked="true"] { color: var(--color-foreground); }
`;

export class AxSegment extends FormControlMixin(BaseComponent) {
  static observedAttributes = ['options', 'value', 'label', 'disabled'];

  constructor() {
    super();
    this.addStyles(CSS);
  }

  get value() {
    const opts = this._opts();
    return opts[this._index()] ?? '';
  }
  set value(v) { this.setAttribute('value', v ?? ''); }

  attributeChangedCallback(name) {
    if (!this._group) return;
    if (name === 'options') this._build();
    else this._sync();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <div class="group" part="group" role="radiogroup">
        <span class="puck" part="puck" aria-hidden="true"></span>
      </div>`;
    this._group = this.shadowRoot.querySelector('.group');
    this._defaultValue = this.getAttribute('value'); // for form reset

    this._group.addEventListener('click', e => {
      const seg = e.target.closest('.seg');
      if (seg) this._select(Number(seg.dataset.i), true);
    });
    this._group.addEventListener('keydown', e => {
      const n = this._opts().length;
      if (!n) return;
      let next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (this._index() + 1) % n;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (this._index() - 1 + n) % n;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = n - 1;
      if (next === null) return;
      e.preventDefault();
      this._select(next, true);
      this._group.querySelectorAll('.seg')[next]?.focus();
    });
    this._build();
  }

  _opts() {
    return (this.getAttribute('options') || '').split(',').map(s => s.trim()).filter(Boolean);
  }

  _index() {
    const opts = this._opts();
    const i = opts.indexOf(this.getAttribute('value'));
    return i === -1 ? 0 : i;
  }

  _build() {
    const opts = this._opts();
    this._group.style.setProperty('--seg-count', String(opts.length || 1));
    this._group.querySelectorAll('.seg').forEach(el => el.remove());
    this._group.insertAdjacentHTML('beforeend', opts.map((o, i) =>
      `<button type="button" class="seg" role="radio" data-i="${i}"><span>${this._esc(o)}</span></button>`
    ).join(''));
    this._sync();
  }

  _select(i, emit) {
    const opts = this._opts();
    if (!opts.length) return;
    const clamped = Math.max(0, Math.min(opts.length - 1, i));
    const changed = clamped !== this._index();
    this.setAttribute('value', opts[clamped]);
    if (emit && changed) {
      this.dispatchEvent(new CustomEvent('change', {
        bubbles: true, composed: true, detail: { value: opts[clamped], index: clamped }
      }));
    }
  }

  _sync() {
    const opts = this._opts();
    const idx = this._index();
    this._group.setAttribute('aria-label', this.getAttribute('label') || 'Segments');
    this._group.querySelectorAll('.seg').forEach((el, i) => {
      el.setAttribute('aria-checked', String(i === idx));
      el.tabIndex = i === idx ? 0 : -1;
      el.disabled = this.hasAttribute('disabled') || this.hasAttribute('data-form-disabled');
    });
    const puck = this._group.querySelector('.puck');
    puck.style.transform = `translateX(${idx * 100}%)`;
    puck.style.display = opts.length ? '' : 'none';
    this._setFormValue(opts[idx] ?? null);
  }

  _formReset() {
    if (this._defaultValue === null) this.removeAttribute('value');
    else this.setAttribute('value', this._defaultValue);
    this._sync();
  }
}

customElements.define('ax-segment', AxSegment);
```

- [ ] **Step 2: Verify.** Run: `node --check src/shared/controls/ax-segment.js && npm run lint:motion`

- [ ] **Step 3: Commit**

```bash
git add src/shared/controls/ax-segment.js
git commit -m "feat(forms): ax-segment — sliding-puck segmented radiogroup with native radio keyboard parity"
```

**CONTROLLER MILESTONE after Task 6:** live-browser pass on all five controls in isolation (scratch page or console-mounted on /components): typing/validity in field, textarea growth cap, select full keyboard walk (open/arrows/Home/End/type-ahead/Enter/Escape/outside-click/flip near viewport bottom), checkbox Space, segment arrows + puck spring. Both themes.

---

### Task 7: Contact migration + legacy deletion

**Files:**
- Modify: `src/features/contact/contact.js` (full rewrite below)
- Delete: `src/shared/custom-input.js`, `src/shared/form-validator.js`, `src/shared/styles/forms.css`
- Unchanged: `src/features/contact/contact.css` (its .contact-container/.contact-form/.actions rules still apply; it contains no input styling — that lived in forms.css)

**Interfaces:**
- Consumes: `<ax-field>` (Task 2: `error` property, `reportValidity()`, `input` event `detail.value`), `<ax-textarea>` (Task 3), `<ax-button>` (existing: `type="submit"` calls `internals.form.requestSubmit()`; `loading` attr).

- [ ] **Step 1: Replace `src/features/contact/contact.js` entirely with:**

```js
import { BaseComponent } from '@shared/base-component.js';
import { state } from '@state';
import '@shared/controls/ax-field.js';
import '@shared/controls/ax-textarea.js';
import '@shared/controls/ax-button.js';

class ContactUI extends BaseComponent {
  // A11y: don't delegate the router's post-navigation focus() into the first
  // focusable child (scrolls it into view → mobile URL bar + focus ring);
  // focus the host container instead. Parity with daystrom page components.
  static delegatesFocus = false;

  async setup() {
    const cssPath = new URL('./contact.css', import.meta.url).href;
    await this.addExternalStyles(cssPath);
  }

  onRendered() {
    this.form = this.shadowRoot.querySelector('form');
    const message = this.shadowRoot.querySelector('[name="message"]');
    // Custom rule (replaces FormValidator's registerRule('nospam')):
    // the error property is a setCustomValidity proxy and shows immediately.
    message.addEventListener('input', e => {
      message.error = e.detail.value.toLowerCase().includes('spam') ? 'No spam allowed!' : '';
    });
    this.form.addEventListener('submit', e => this.handleSubmit(e));
  }

  disconnectedCallback() {
    this._sendController?.abort();
    super.disconnectedCallback();
  }

  async handleSubmit(e) {
    e.preventDefault();

    if (!this.form.checkValidity()) {
      // Mark every field touched so messages show, then focus the first
      // invalid host (formAssociated hosts match :invalid; delegatesFocus
      // routes focus() to the inner input).
      this.form.querySelectorAll('ax-field, ax-textarea').forEach(f => f.reportValidity());
      this.form.querySelector(':invalid')?.focus();
      return;
    }

    this._sendController?.abort();
    this._sendController = new AbortController();
    const { signal } = this._sendController;

    const submitBtn = this.shadowRoot.querySelector('ax-button');
    submitBtn.setAttribute('loading', '');

    await new Promise(r => setTimeout(r, 1500)); // simulated send
    if (signal.aborted) return;

    state.notify('Message sent successfully!', 'success', 4000);
    this.form.reset(); // controls restore via formResetCallback
    submitBtn.removeAttribute('loading');
  }

  render() {
    this.shadowRoot.innerHTML = `
      <div class="contact-container fade-in">
        <h1>Get in Touch</h1>
        <form class="glass-card contact-form" novalidate>
          <ax-field name="name" label="Name" placeholder="John Doe" required minlength="2"></ax-field>
          <ax-field name="email" type="email" label="Email Address" placeholder="john@example.com" required></ax-field>
          <ax-textarea name="message" label="Message" placeholder="How can we help?" required minlength="10" rows="4"></ax-textarea>
          <div class="actions">
            <ax-button type="submit" variant="fill" tone="primary">Send Message</ax-button>
          </div>
        </form>
      </div>
    `;
  }
}

customElements.define('contact-ui', ContactUI);
```

Note: the old code called `state.notify('Success', 'Message sent successfully!', 4000)` — args swapped versus the `notify(message, type, duration)` signature. The rewrite fixes it (this is deliberate, not drift).

- [ ] **Step 2: Prove the legacy stack is unreferenced, then delete it.**

Run: `grep -rn "custom-input\|form-validator\|forms.css" src/ --include="*.js" --include="*.css" --include="*.html"`
Expected: matches ONLY inside `src/shared/custom-input.js` / `src/shared/form-validator.js` themselves (self-references). If contact.js still matches, Step 1 is incomplete — stop and fix.

```bash
git rm src/shared/custom-input.js src/shared/form-validator.js src/shared/styles/forms.css
```

- [ ] **Step 3: Verify.** Run: `node --check src/features/contact/contact.js && npm run lint:motion && npm run build`
Expected: all clean — the build's `assertNoSrcReferencesInDist` guard confirms no dangling imports.

- [ ] **Step 4: Commit**

```bash
git add -A src/features/contact src/shared
git commit -m "feat(contact): migrate to ax-field/ax-textarea/ax-button — custom-input stack retired"
```

**CONTROLLER MILESTONE after Task 7:** /contact live: submit empty → three messages appear with NO layout jump, focus lands on Name; type "spam" in message → immediate custom error; fix all → loading spinner → success toast (type "success") → form clears clean (no red).

---

### Task 8: Showcase panel, CONTROLS.md, MANIFEST, final gates

**Files:**
- Modify: `src/features/components/components.js` (imports + panel markup + wiring)
- Modify: `src/features/components/components.css` (panel layout)
- Modify: `docs/CONTROLS.md` (five rows + intro notes)
- Modify: `MANIFEST.toml` (new capability)

- [ ] **Step 1: components.js — after the line `import '@shared/controls/ax-knob.js';` add:**

```js
import '@shared/controls/ax-field.js';
import '@shared/controls/ax-textarea.js';
import '@shared/controls/ax-select.js';
import '@shared/controls/ax-checkbox.js';
import '@shared/controls/ax-segment.js';
```

- [ ] **Step 2: components.js — inside `.neu-stage`, immediately after the closing `</div>` of `.neu-viz-panel`, add:**

```html
            <div class="neu-panel neu-form-panel">
              <ax-field surface="neu" label="Callsign" placeholder="CYBR-01" name="callsign">
                <svg slot="suffix" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21v-1a8 8 0 0 1 16 0v1"></path></svg>
              </ax-field>
              <ax-select surface="neu" label="Drive mode" placeholder="Select mode" value="sport" name="mode"
                options='[{"value":"comfort","label":"Comfort"},{"value":"sport","label":"Sport"},{"value":"offroad","label":"Off-Road"}]'></ax-select>
              <ax-segment surface="neu" options="Eco,Normal,Boost" value="Normal" label="Power profile" name="profile"></ax-segment>
              <ax-checkbox surface="neu" label="Telemetry uplink" checked name="telemetry"></ax-checkbox>
              <ax-textarea surface="neu" label="Mission notes" placeholder="Type here…" rows="2" name="notes"></ax-textarea>
              <span class="token-note form-log" aria-live="polite">change → interact above</span>
            </div>
```

- [ ] **Step 3: components.js — in `_wire()`, after the `.demo-knob` listeners, add:**

```js
    // One delegated listener proves the uniform event contract: every form
    // control's change bubbles composed with a detail payload.
    $('.neu-form-panel').addEventListener('change', e => {
      $('.form-log').textContent = `change → ${JSON.stringify(e.detail)}`;
    });
```

- [ ] **Step 4: components.css — append:**

```css
.neu-form-panel { display: flex; flex-direction: column; gap: var(--space-m); min-width: 300px; flex: 1; max-width: 420px; }
.form-log { overflow-wrap: anywhere; }
```

- [ ] **Step 5: docs/CONTROLS.md — append these rows to the contract table:**

```markdown
| ax-field ⚑ | type†(text\|email\|password\|number\|search), value, label, placeholder, required, minlength†, maxlength†, autocomplete†, name, disabled, error | value (live text), error (custom-validity proxy), reportValidity() | input/change ({value}) | prefix, suffix | surface="neu" (carved well); message shows after first blur (touched model) |
| ax-textarea ⚑ | value, label, placeholder, required, minlength†, maxlength†, rows†, max-rows†, name, disabled, error | value, error, reportValidity() | input/change ({value}) | — | surface="neu"; auto-grows to max-rows (default 3→8) |
| ax-select ⚑ | options (JSON), value, label, placeholder, required, name, disabled | options = [{value,label}] (property wins over attribute); value; reportValidity() | change ({value, label}) | — | surface="neu" (carved well); the open menu is ALWAYS an opaque raised panel; full keyboard listbox (arrows/Home/End/type-ahead/Escape) |
| ax-checkbox ⚑ | checked, disabled, label, value, name | checked | change ({checked}) | — | surface="neu" (raised tile → pressed lit well); VISIBLE label; Space toggles |
| ax-segment ⚑ | options="A,B,C", value (selected label; defaults first), label, name, disabled | value | change ({value, index}) | — | surface="neu" (carved rail, raised puck); arrows move AND select (radio parity) |
```

- [ ] **Step 6: docs/CONTROLS.md — after the intro paragraph (before the table), add:**

```markdown
Form-entry controls (ax-field/ax-textarea/ax-select/ax-checkbox/ax-segment) differ from
hardware controls in three deliberate ways: their `label` attr renders a VISIBLE label;
validation messages follow a "touched" model (nothing shows before first blur or
`reportValidity()` — do NOT style `ax-*:invalid` from page CSS, hosts match `:invalid`
from first paint); and text wells show their focus ring on pointer focus too
(focus-within chrome — carets need visible context). ax-toggle vs ax-checkbox: a toggle
is a live setting that applies immediately; a checkbox is a form choice submitted later.
```

- [ ] **Step 7: MANIFEST.toml — after the `neu-surface-tier` capability block, add:**

```toml
[[capabilities]]
id = "neu-form-control-set"
tags = ["es6", "web-components", "a11y", "forms", "design-system"]
claim = "Form-entry controls: ax-field/ax-textarea (mirrored constraint validation, touched-model messages), ax-select (owned listbox menu — no OS popup — with full keyboard model and flip-up), ax-checkbox (visible-label form tile), ax-segment (sliding-puck radiogroup); shared FIELD_CHROME_CSS + FormControlMixin (ElementInternals reset/disabled/validity plumbing); all formAssociated, base look matches theme.css global inputs, surface=neu carves the wells; /contact migrated off the retired custom-input/FormValidator stack. Depends on neu-surface-tier; sync src/shared/ wholesale."
maturity = "shipped"
entry_points = ["src/shared/controls/", "docs/CONTROLS.md", "docs/superpowers/specs/2026-07-21-neu-form-controls-design.md"]
```

- [ ] **Step 8: Final gates.** Run: `node --check src/features/components/components.js && npm run lint:motion && npm run build && npm run test:tools`
Expected: motion gate clean, build complete, 13/13 tool tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/features/components docs/CONTROLS.md MANIFEST.toml
git commit -m "feat(forms): neu form showcase panel + CONTROLS.md rows + neu-form-control-set claim"
```

**CONTROLLER MILESTONE after Task 8 (final):** /components neu form panel — full keyboard tab order through the panel; select opens INSIDE the dark stage legibly; change log line updates from every control; both themes; reduced-motion (puck/menu snap instantly); mobile-width single column. Then whole-branch final review per SDD.
