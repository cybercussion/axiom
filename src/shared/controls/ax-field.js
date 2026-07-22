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
