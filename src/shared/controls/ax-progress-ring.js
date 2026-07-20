/**
 * <ax-progress-ring value="83" size="44"> — circular gauge on a
 * --control-track rail. Sweep tweens via stroke-dashoffset (never jumps).
 * At 100 the arc completes and a check mark draws in.
 */
import { BaseComponent } from '@shared/base-component.js';

const STROKE = 4;

const CSS = `
  :host { display: inline-flex; }
  svg { display: block; transform: rotate(-90deg); }
  .rail { stroke: var(--control-track); fill: none; }
  .arc {
    stroke: var(--color-primary); fill: none; stroke-linecap: round;
    transition: stroke-dashoffset var(--duration-slow) var(--ease-out-soft),
      stroke var(--duration-fast) var(--ease-out-soft);
  }
  :host([data-done]) .arc { stroke: var(--success-color); }
  .check {
    stroke: var(--success-color); fill: none; stroke-width: ${STROKE};
    stroke-linecap: round; stroke-linejoin: round;
    transform: rotate(90deg); transform-origin: center;
    stroke-dasharray: var(--check-len, 30); stroke-dashoffset: var(--check-len, 30);
    transition: stroke-dashoffset var(--duration-base) var(--ease-spring);
  }
  :host([data-done]) .check { stroke-dashoffset: 0; }
  /* ===== surface="neu" — control indicator: aurora arc is its intended use. ===== */
  :host([surface="neu"]) .rail { stroke: var(--neu-surface-deep); }
  :host([surface="neu"]) .arc {
    stroke: var(--accent-glow);
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent-glow) 60%, transparent));
  }
  :host([surface="neu"][data-done]) .arc {
    stroke: var(--success-color);
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--success-color) 60%, transparent));
  }
`;

export class AxProgressRing extends BaseComponent {
  static observedAttributes = ['value', 'label'];

  constructor() {
    super();
    this._internals = this.attachInternals();
    this._internals.role = 'progressbar';
    this.addStyles(CSS);
  }

  get value() { return this._value ?? 0; }
  set value(v) { this.setAttribute('value', v); }

  attributeChangedCallback() {
    if (this._arc) this._sync();
  }

  render() {
    const rawSize = Number(this.getAttribute('size'));
    const size = rawSize > 0 ? rawSize : 44;
    const r = (size - STROKE) / 2;
    const c = 2 * Math.PI * r;
    this._circumference = c;
    const mid = size / 2;
    this.shadowRoot.innerHTML = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle class="rail" cx="${mid}" cy="${mid}" r="${r}" stroke-width="${STROKE}"></circle>
        <circle class="arc" cx="${mid}" cy="${mid}" r="${r}" stroke-width="${STROKE}"
          stroke-dasharray="${c}" stroke-dashoffset="${c}"></circle>
        <path class="check" style="--check-len: ${Math.ceil(r * 1.4)}" d="M ${mid - r * 0.42} ${mid} l ${r * 0.3} ${r * 0.3} l ${r * 0.55} ${-r * 0.6}"></path>
      </svg>`;
    this._arc = this.shadowRoot.querySelector('.arc');
    // Double rAF so the initial dashoffset commits before the sweep target,
    // otherwise the first paint jumps instead of animating.
    requestAnimationFrame(() => requestAnimationFrame(() => this._sync()));
  }

  _sync() {
    const raw = Number(this.getAttribute('value'));
    this._value = Number.isNaN(raw) ? 0 : Math.min(100, Math.max(0, raw));
    this._arc.style.strokeDashoffset = String(this._circumference * (1 - this._value / 100));
    this.toggleAttribute('data-done', this._value >= 100);
    this._internals.ariaLabel = this.getAttribute('label') || 'Progress';
    this._internals.ariaValueMin = '0';
    this._internals.ariaValueMax = '100';
    this._internals.ariaValueNow = String(this._value);
  }
}

customElements.define('ax-progress-ring', AxProgressRing);
