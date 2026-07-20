/**
 * <ax-stepper value="20" min="0" max="100" step="5" label="Capacity"> —
 * chevron up/down keys on a raised neu pill. Hold-to-repeat uses PLAIN
 * interaction constants (NOT motionMs): repeat cadence is input rate, not a
 * transition wait, and must not collapse under reduced motion.
 */
import { BaseComponent } from '@shared/base-component.js';

const HOLD_DELAY_MS = 400;
const HOLD_REPEAT_MS = 120;

const CSS = `
  :host { display: inline-flex; }
  .pill {
    display: flex; flex-direction: column; border-radius: 999px;
    background: var(--neu-face); box-shadow: var(--neu-raised-sm);
    overflow: hidden;
  }
  :host([orientation="horizontal"]) .pill { flex-direction: row-reverse; }
  .key {
    all: unset; cursor: pointer; min-width: 44px; min-height: 44px;
    display: flex; align-items: center; justify-content: center;
    color: var(--color-foreground);
    transition: background var(--duration-fast) var(--ease-out-soft),
      opacity var(--duration-fast) var(--ease-out-soft);
    -webkit-tap-highlight-color: transparent;
  }
  .key:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
  .key:active { background: var(--neu-face-pressed); box-shadow: var(--neu-well); }
  .key[aria-disabled="true"] { opacity: 0.35; cursor: default; }
  .key svg { width: 16px; height: 16px; }
`;

export class AxStepper extends BaseComponent {
  static formAssociated = true;
  static observedAttributes = ['value', 'min', 'max', 'step', 'label'];

  constructor() {
    super();
    this._internals = this.attachInternals();
    this._internals.role = 'spinbutton';
    this.addStyles(CSS);
    this._stopHold = () => { clearTimeout(this._holdTimer); clearInterval(this._holdRepeat); };
  }

  get value() { return this._value ?? 0; }
  set value(v) { this.setAttribute('value', v); }

  attributeChangedCallback() {
    if (this._pill) this._sync();
  }

  render() {
    const chevron = dir => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="${dir > 0 ? '6 15 12 9 18 15' : '6 9 12 15 18 9'}"></polyline></svg>`;
    this.shadowRoot.innerHTML = `
      <div class="pill" part="pill">
        <button class="key" data-dir="1" aria-label="Increase">${chevron(1)}</button>
        <button class="key" data-dir="-1" aria-label="Decrease">${chevron(-1)}</button>
      </div>`;
    this._pill = this.shadowRoot.querySelector('.pill');

    this._pill.addEventListener('pointerdown', e => {
      const key = e.target.closest('.key');
      if (!key || key.getAttribute('aria-disabled') === 'true') return;
      const dir = Number(key.dataset.dir);
      this._bump(dir);
      this._holdTimer = setTimeout(() => {
        this._holdRepeat = setInterval(() => this._bump(dir), HOLD_REPEAT_MS);
      }, HOLD_DELAY_MS);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t =>
      this._pill.addEventListener(t, this._stopHold));

    this._pill.addEventListener('keydown', e => {
      const horizontal = this.getAttribute('orientation') === 'horizontal';
      const up = horizontal ? 'ArrowRight' : 'ArrowUp';
      const down = horizontal ? 'ArrowLeft' : 'ArrowDown';
      if (e.key === up) { this._bump(1); e.preventDefault(); }
      if (e.key === down) { this._bump(-1); e.preventDefault(); }
    });

    this._sync();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopHold();
  }

  _bounds() {
    const min = Number(this.getAttribute('min')); const max = Number(this.getAttribute('max'));
    return {
      min: Number.isFinite(min) ? min : 0,
      max: Number.isFinite(max) ? max : 100,
      step: Number(this.getAttribute('step')) > 0 ? Number(this.getAttribute('step')) : 1
    };
  }

  _bump(dir) {
    const { min, max, step } = this._bounds();
    const next = Math.min(max, Math.max(min, this.value + dir * step));
    if (next === this.value) { this._stopHold(); return; }
    this.setAttribute('value', String(next));
    this.dispatchEvent(new CustomEvent('change', {
      bubbles: true, composed: true, detail: { value: next }
    }));
  }

  _sync() {
    const { min, max } = this._bounds();
    const raw = Number(this.getAttribute('value'));
    this._value = Number.isNaN(raw) ? min : Math.min(max, Math.max(min, raw));
    this._internals.ariaLabel = this.getAttribute('label') || 'Stepper';
    this._internals.ariaValueMin = String(min);
    this._internals.ariaValueMax = String(max);
    this._internals.ariaValueNow = String(this._value);
    const [inc, dec] = this._pill.querySelectorAll('.key');
    inc.setAttribute('aria-disabled', String(this._value >= max));
    dec.setAttribute('aria-disabled', String(this._value <= min));
  }
}

customElements.define('ax-stepper', AxStepper);
