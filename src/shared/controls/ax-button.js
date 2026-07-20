/**
 * <ax-button variant="fill|outline|ghost" tone="primary|..." loading>
 * Wraps the house .btn styles (adopted theme.css) + press physics + loading state.
 */
import { BaseComponent } from '@shared/base-component.js';

const CSS = `
  :host { display: inline-flex; }
  :host([disabled]), :host([loading]) { pointer-events: none; }
  :host([disabled]) { opacity: 0.5; }
  .btn { position: relative; min-height: 44px; }
  .btn:active { transform: scale(0.96); }
  .label {
    display: inline-flex; align-items: center; gap: 0.6em;
    transition: opacity var(--duration-fast) var(--ease-out-soft);
  }
  .spinner {
    position: absolute; inset: 0; display: flex;
    align-items: center; justify-content: center;
    opacity: 0;
    transition: opacity var(--duration-fast) var(--ease-out-soft);
  }
  .spinner::after {
    content: ''; width: 1.1em; height: 1.1em; border-radius: 50%;
    border: 2px solid currentColor; border-right-color: transparent;
    animation: ax-spin 0.8s linear infinite; /* motion-gate: allow */
  }
  @keyframes ax-spin { to { rotate: 360deg; } }
  :host([loading]) .label { opacity: 0; }
  :host([loading]) .spinner { opacity: 1; }

  /* ===== surface="neu" — raised hardware key (ON-key feel) ===== */
  :host([surface="neu"]) .btn {
    background: var(--neu-face);
    color: var(--color-foreground);
    text-shadow: none;
    box-shadow: var(--neu-raised-sm);
  }
  :host([surface="neu"]) .btn:hover { transform: none; filter: none; box-shadow: var(--neu-raised); }
  :host([surface="neu"]) .btn:active {
    transform: none;
    background: var(--neu-face-pressed);
    box-shadow: var(--neu-well);
  }
  :host([surface="neu"][tone="danger"]) .btn { color: var(--danger-color); }
  :host([surface="neu"][tone="success"]) .btn { color: var(--success-color); }
  :host([surface="neu"][shape="round"]) .btn {
    border-radius: 50%; padding: 0; width: 56px; height: 56px; min-height: 56px;
  }
`;

export class AxButton extends BaseComponent {
  static formAssociated = true;
  static observedAttributes = ['loading', 'disabled'];

  constructor() {
    super();
    this._internals = this.attachInternals();
    this.addStyles(CSS);
  }

  _syncState() {
    const loading = this.hasAttribute('loading');
    this._btn.disabled = this.hasAttribute('disabled') || loading;
    this._btn.setAttribute('aria-busy', String(loading));
  }

  attributeChangedCallback() {
    if (this._btn) this._syncState();
  }

  render() {
    const variant = this.getAttribute('variant') || 'fill';
    const tone = this.getAttribute('tone') || 'primary';
    this.shadowRoot.innerHTML = `
      <button type="button" class="btn btn-${this._esc(variant)} btn-${this._esc(tone)}" part="button">
        <span class="label" part="label"><slot></slot></span>
        <span class="spinner" aria-hidden="true"></span>
      </button>`;
    this._btn = this.shadowRoot.querySelector('button');
    this._btn.addEventListener('click', () => {
      if ((this.getAttribute('type') || 'button') === 'submit') {
        this._internals.form?.requestSubmit();
      }
    });
    this._syncState();
  }
}

customElements.define('ax-button', AxButton);
