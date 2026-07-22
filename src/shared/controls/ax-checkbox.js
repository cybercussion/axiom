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
    min-height: 44px; min-width: 44px; cursor: pointer;
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
    const disabled = this.hasAttribute('disabled') || this.hasAttribute('data-form-disabled');
    this._box.tabIndex = disabled ? -1 : 0;          // disabled = out of the tab order
    this._box.setAttribute('aria-disabled', String(disabled));
    this.shadowRoot.querySelector('.text').textContent = this.getAttribute('label') || '';
    this._setFormValue(this.checked ? (this.getAttribute('value') || 'on') : null);
  }

  _formReset() {
    this.checked = this._defaultChecked;
    this._sync();
  }
}

customElements.define('ax-checkbox', AxCheckbox);
