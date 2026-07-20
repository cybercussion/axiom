/**
 * <ax-gauge value="29" unit="%" label="Battery power"> — vertical neu meter:
 * tick ruler at left, deep inset well, glowing aurora fill. Height-based
 * fill (never scale — scaling squashes rounded caps).
 */
import { BaseComponent } from '@shared/base-component.js';

const CSS = `
  :host { display: inline-flex; }
  .gauge { display: flex; gap: var(--space-s); align-items: stretch; }
  .ruler {
    display: flex; flex-direction: column; justify-content: space-between;
    font-family: var(--font-mono); font-size: var(--text-xs);
    color: var(--color-muted); text-align: right; user-select: none;
  }
  .ruler span::after { content: ' –'; }
  .well {
    position: relative; width: 56px; border-radius: 999px;
    background: var(--neu-surface-deep); box-shadow: var(--neu-well);
    overflow: hidden;
  }
  .fill {
    position: absolute; left: 4px; right: 4px; bottom: 4px; height: 0;
    border-radius: 999px;
    background: linear-gradient(180deg,
      color-mix(in srgb, var(--accent-glow) 70%, var(--color-primary)) 0%,
      var(--color-primary) 100%);
    box-shadow: 0 0 18px color-mix(in srgb, var(--accent-glow) 45%, transparent);
    transition: height var(--duration-slow) var(--ease-out-soft);
  }
  :host([data-empty]) .fill { box-shadow: none; }
`;

export class AxGauge extends BaseComponent {
  static observedAttributes = ['value', 'max', 'unit', 'label'];

  constructor() {
    super();
    this._internals = this.attachInternals();
    this._internals.role = 'meter';
    this.addStyles(CSS);
  }

  get value() { return this._value ?? 0; }
  set value(v) { this.setAttribute('value', v); }

  attributeChangedCallback() {
    if (this._fill) this._sync();
  }

  render() {
    const height = Number(this.getAttribute('height')) > 0 ? Number(this.getAttribute('height')) : 240;
    const ticks = Number(this.getAttribute('ticks')) > 1 ? Number(this.getAttribute('ticks')) : 6;
    const max = this._max();
    const labels = Array.from({ length: ticks }, (_, i) =>
      Math.round(max - i * (max / (ticks - 1))));
    this.shadowRoot.innerHTML = `
      <div class="gauge" part="gauge" style="height: ${height}px">
        <div class="ruler" part="ruler" aria-hidden="true">
          ${labels.map(l => `<span>${l}</span>`).join('')}
        </div>
        <div class="well" part="well"><div class="fill" part="fill"></div></div>
      </div>
      <span class="sr-only" data-summary></span>`;
    this._fill = this.shadowRoot.querySelector('.fill');
    // Double rAF so the initial 0-height commits and the first value tweens in.
    requestAnimationFrame(() => requestAnimationFrame(() => this._sync()));
  }

  _max() {
    const m = Number(this.getAttribute('max'));
    return Number.isFinite(m) && m > 0 ? m : 100;
  }

  _sync() {
    const max = this._max();
    const attr = this.getAttribute('value');
    const raw = attr === null ? NaN : Number(attr);
    const empty = Number.isNaN(raw);
    this.toggleAttribute('data-empty', empty);
    this._value = empty ? 0 : Math.min(max, Math.max(0, raw));
    this._fill.style.height = `calc(${(this._value / max) * 100}% - 8px)`;
    const unit = this.getAttribute('unit') || '';
    this._internals.ariaLabel = this.getAttribute('label') || 'Gauge';
    this._internals.ariaValueMin = '0';
    this._internals.ariaValueMax = String(max);
    this._internals.ariaValueNow = String(this._value);
    this.shadowRoot.querySelector('[data-summary]').textContent =
      empty ? 'no reading' : `${this._value}${unit} of ${max}${unit}`;
  }
}

customElements.define('ax-gauge', AxGauge);
