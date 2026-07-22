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
  /* .well textarea, not bare textarea: theme.css's global textarea:focus
     (0,1,1) from the adopted theme sheet out-specifies a bare reset and paints
     its own focus halo inside the well ring (see ax-field for the full note). */
  .well textarea {
    background: transparent; border: none; outline: none;
    box-shadow: none; border-radius: 0;
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

    // Replay an error set before first render — property (buffered in _error)
    // or attribute; the property, like value, must survive pre-connect sets.
    const initErr = this._error || this.getAttribute('error') || '';
    if (initErr) this.error = initErr;
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
