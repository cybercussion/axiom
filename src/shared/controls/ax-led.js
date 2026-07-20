/**
 * <ax-led tone="ok|info|warn|danger|off" pulse label="Link up"> — status dot.
 * Never color-alone: a labeled LED announces via role=status; an unlabeled
 * one is decoration and is aria-hidden.
 */
import { BaseComponent } from '@shared/base-component.js';

const TONES = ['ok', 'info', 'warn', 'danger', 'off'];

const CSS = `
  :host { display: inline-flex; }
  .led {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--color-muted); opacity: 0.35;
    transition: background var(--duration-fast) var(--ease-out-soft),
      box-shadow var(--duration-fast) var(--ease-out-soft),
      opacity var(--duration-fast) var(--ease-out-soft);
  }
  .led.ok { background: var(--success-color); opacity: 1; box-shadow: 0 0 8px var(--success-color); }
  .led.info { background: var(--accent-glow); opacity: 1; box-shadow: 0 0 8px var(--accent-glow); }
  .led.warn { background: var(--warning-color); opacity: 1; box-shadow: 0 0 8px var(--warning-color); }
  .led.danger { background: var(--danger-color); opacity: 1; box-shadow: 0 0 8px var(--danger-color); }
  :host([pulse]) .led:not(.off) {
    animation: ax-led-pulse 2s var(--ease-cinematic) infinite; /* motion-gate: allow */
  }
  @keyframes ax-led-pulse { 50% { opacity: 0.45; } }
  /* Pulse carries no state — kill it for reduced-motion users (the
     [data-motion] preview can't pierce shadow CSS; OS setting governs). */
  @media (prefers-reduced-motion: reduce) {
    :host([pulse]) .led { animation: none; }
  }
`;

export class AxLed extends BaseComponent {
  static observedAttributes = ['tone', 'label'];

  constructor() {
    super();
    this._internals = this.attachInternals();
    this.addStyles(CSS);
  }

  attributeChangedCallback() {
    if (this._led) this._sync();
  }

  render() {
    this.shadowRoot.innerHTML = `<span class="led" part="led"></span>`;
    this._led = this.shadowRoot.querySelector('.led');
    this._sync();
  }

  _sync() {
    const tone = TONES.includes(this.getAttribute('tone')) ? this.getAttribute('tone') : 'off';
    this._led.className = `led ${tone}`;
    const label = this.getAttribute('label');
    if (label) {
      this._internals.role = 'status';
      this._internals.ariaLabel = `${label}: ${tone}`;
      this.removeAttribute('aria-hidden');
    } else {
      this._internals.role = 'presentation';
      this.setAttribute('aria-hidden', 'true');
    }
  }
}

customElements.define('ax-led', AxLed);
