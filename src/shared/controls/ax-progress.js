/**
 * <ax-progress> — determinate (tweened, never jumps) + indeterminate bar.
 */
import { BaseComponent } from '@shared/base-component.js';

const CSS = `
  :host { display: block; width: 100%; }
  .track {
    height: 6px; border-radius: 3px; overflow: hidden;
    background: var(--control-track);
  }
  .fill {
    height: 100%; border-radius: 3px; background: var(--color-primary);
    transform-origin: left; transform: scaleX(var(--p, 0));
    transition: transform var(--duration-slow) var(--ease-out-soft);
  }
  :host([indeterminate]) .fill, :host([data-nan]) .fill {
    transform: none; width: 40%;
    animation: ax-indeterminate 1.4s var(--ease-cinematic) infinite; /* motion-gate: allow */
  }
  @keyframes ax-indeterminate {
    from { translate: -100% 0; }
    to { translate: 250% 0; }
  }
`;

export class AxProgress extends BaseComponent {
  static observedAttributes = ['value', 'max', 'indeterminate', 'label'];

  constructor() {
    super();
    this._internals = this.attachInternals();
    this._internals.role = 'progressbar';
    this.addStyles(CSS);
  }

  get value() { return this._value ?? 0; }
  set value(v) { this.setAttribute('value', v); }

  attributeChangedCallback() {
    if (this._fill) this._sync();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <div class="track" part="track"><div class="fill" part="fill"></div></div>`;
    this._fill = this.shadowRoot.querySelector('.fill');
    this._sync();
  }

  _sync() {
    const rawMax = Number(this.getAttribute('max'));
    const max = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 100;
    const raw = Number(this.getAttribute('value'));
    this._internals.ariaLabel = this.getAttribute('label') || 'Progress';
    // Derived NaN state uses data-nan (unobserved) so it self-recovers when a
    // valid value arrives — the public `indeterminate` attr stays consumer-owned.
    this.toggleAttribute('data-nan', Number.isNaN(raw) && !this.hasAttribute('indeterminate'));
    if (this.hasAttribute('indeterminate') || Number.isNaN(raw)) {
      this._internals.ariaValueNow = null;
      return;
    }
    this._value = Math.min(max, Math.max(0, raw));
    this._fill.style.setProperty('--p', String(this._value / max));
    this._internals.ariaValueMin = '0';
    this._internals.ariaValueMax = String(max);
    this._internals.ariaValueNow = String(this._value);
  }
}

customElements.define('ax-progress', AxProgress);
