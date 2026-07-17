/**
 * <ax-toggle> — springy switch. Dumb control: attributes in, `change` event out.
 * formAssociated: submits `value` (default "on") when checked.
 */
import { BaseComponent } from '@shared/base-component.js';

const CSS = `
  :host { display: inline-flex; }
  :host([disabled]) { opacity: 0.5; pointer-events: none; }
  button {
    all: unset; position: relative; display: inline-flex;
    align-items: center; justify-content: center;
    min-width: 44px; min-height: 44px; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: 12px; }
  .track {
    width: 36px; height: 20px; border-radius: 10px;
    background: var(--input-border);
    transition: background var(--duration-fast) var(--ease-out-soft);
  }
  .thumb {
    position: absolute; left: calc(50% - 16px); top: calc(50% - 8px);
    width: 16px; height: 16px; border-radius: 50%;
    background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: transform var(--duration-base) var(--ease-spring);
  }
  button:active .thumb { transform: scaleX(1.15); transform-origin: left; }
  :host([checked]) .track { background: var(--color-primary); }
  :host([checked]) .thumb { transform: translateX(16px); }
  :host([checked]) button:active .thumb { transform: translateX(16px) scaleX(1.15); transform-origin: right; }
`;

export class AxToggle extends BaseComponent {
  static formAssociated = true;
  static observedAttributes = ['checked', 'disabled', 'label', 'value'];

  constructor() {
    super();
    this._internals = this.attachInternals();
    this.addStyles(CSS);
  }

  get checked() { return this.hasAttribute('checked'); }
  set checked(v) { this.toggleAttribute('checked', Boolean(v)); }

  attributeChangedCallback() {
    if (this._btn) this._syncState();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <button type="button" role="switch" part="button">
        <span class="track" part="track"></span>
        <span class="thumb" part="thumb"></span>
      </button>`;
    this._btn = this.shadowRoot.querySelector('button');
    this._btn.addEventListener('click', () => {
      this.checked = !this.checked;
      this.dispatchEvent(new CustomEvent('change', {
        bubbles: true, composed: true, detail: { checked: this.checked }
      }));
    });
    this._syncState();
  }

  _syncState() {
    this._btn.setAttribute('aria-checked', String(this.checked));
    this._btn.setAttribute('aria-label', this.getAttribute('label') || 'Toggle');
    this._btn.disabled = this.hasAttribute('disabled');
    this._internals.setFormValue(this.checked && !this.hasAttribute('disabled') ? (this.getAttribute('value') || 'on') : null);
  }
}

customElements.define('ax-toggle', AxToggle);
