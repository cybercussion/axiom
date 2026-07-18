/**
 * <ax-trend value="-3.54" good></ax-trend> — signed delta with arrow.
 * `good` = downward is desirable (weight loss). Sign + arrow carry the
 * meaning; color is reinforcement, never the only channel.
 */
import { BaseComponent } from '@shared/base-component.js';

const CSS = `
  :host { display: inline-flex; }
  .trend {
    display: inline-flex; align-items: center; gap: 0.25em;
    font-size: var(--text-xs); font-weight: 600;
    font-family: var(--font-mono);
    transition: color var(--duration-fast) var(--ease-out-soft);
  }
  .trend.up-good, .trend.down-good { color: var(--success-color); }
  .trend.up-bad, .trend.down-bad { color: var(--danger-color); }
  .trend.flat { color: var(--color-muted); }
`;

export class AxTrend extends BaseComponent {
  static observedAttributes = ['value', 'good'];

  constructor() {
    super();
    this.addStyles(CSS);
  }

  get value() { return Number(this.getAttribute('value')) || 0; }
  set value(v) { this.setAttribute('value', v); }

  attributeChangedCallback() {
    if (this._el) this._sync();
  }

  render() {
    this.shadowRoot.innerHTML = `<span class="trend" part="trend"></span>`;
    this._el = this.shadowRoot.querySelector('.trend');
    this._sync();
  }

  _sync() {
    const v = this.value;
    const goodDown = this.hasAttribute('good');
    const up = v > 0;
    const cls = v === 0 ? 'flat'
      : up ? (goodDown ? 'up-bad' : 'up-good')
      : (goodDown ? 'down-good' : 'down-bad');
    this._el.className = `trend ${cls}`;
    const arrow = v === 0 ? '' : up ? '▲ ' : '▼ ';
    const sign = up ? '+' : '';
    this._el.textContent = `${arrow}${sign}${v.toFixed(2)}%`;
    this._el.setAttribute('aria-label',
      v === 0 ? 'unchanged' : `${up ? 'up' : 'down'} ${Math.abs(v).toFixed(2)} percent`);
  }
}

customElements.define('ax-trend', AxTrend);
