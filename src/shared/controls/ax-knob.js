/**
 * <ax-knob value="30" label="Volume"> — neu rotary dial. Value sweeps a
 * 270° glowing arc (-135°..+135°); interaction is VERTICAL drag
 * (synth-plugin convention — no circular-tracking ambiguity), pointer
 * captured; Escape cancels the drag. No wheel handling (scroll hijack).
 */
import { BaseComponent } from '@shared/base-component.js';

const STROKE = 6; // thick arc per the Cybertruck dial reference
const SWEEP = 0.75; // 270° of the circle
const DRAG_RANGE_PX = 150; // full-range vertical travel

const CSS = `
  :host { display: inline-flex; }
  .knob {
    position: relative; border-radius: 50%; cursor: ns-resize;
    touch-action: none; -webkit-tap-highlight-color: transparent;
    outline-offset: 4px;
  }
  .knob:focus-visible { outline: 2px solid var(--color-primary); }
  svg { position: absolute; inset: 0; transform: rotate(135deg); pointer-events: none; }
  .rail { stroke: var(--control-track); fill: none; }
  .arc {
    stroke: var(--accent-glow); fill: none; stroke-linecap: round;
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent-glow) 60%, transparent));
    transition: stroke-dasharray var(--duration-fast) var(--ease-out-soft);
  }
  .disc {
    position: absolute; inset: 10px; border-radius: 50%;
    background: var(--neu-face); box-shadow: var(--neu-raised);
  }
  .knob:active .disc { background: var(--neu-face-pressed); }
  .dot {
    position: absolute; left: calc(50% - 3px); top: calc(50% - 3px);
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--accent-glow);
    box-shadow: 0 0 6px var(--accent-glow);
    transform: rotate(var(--ang, -135deg)) translateY(calc(var(--dot-r) * -1));
    transition: transform var(--duration-fast) var(--ease-out-soft);
  }
`;

export class AxKnob extends BaseComponent {
  static formAssociated = true;
  static observedAttributes = ['value', 'min', 'max', 'step', 'label'];

  constructor() {
    super();
    this._internals = this.attachInternals();
    this.addStyles(CSS);
  }

  get value() { return this._value ?? 0; }
  set value(v) { this.setAttribute('value', v); }

  attributeChangedCallback() {
    if (this._knob) this._sync();
  }

  render() {
    const size = Number(this.getAttribute('size')) > 0 ? Number(this.getAttribute('size')) : 96;
    const r = (size - STROKE) / 2;
    this._circumference = 2 * Math.PI * r;
    const mid = size / 2;
    this.shadowRoot.innerHTML = `
      <div class="knob" part="knob" role="slider" tabindex="0" style="width:${size}px;height:${size}px;--dot-r:${mid - 22}px">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
          <circle class="rail" cx="${mid}" cy="${mid}" r="${r}" stroke-width="${STROKE}"
            stroke-dasharray="${this._circumference * SWEEP} ${this._circumference}"></circle>
          <circle class="arc" cx="${mid}" cy="${mid}" r="${r}" stroke-width="${STROKE}"
            stroke-dasharray="0 ${this._circumference}"></circle>
        </svg>
        <div class="disc" part="disc"></div>
        <span class="dot" part="dot"></span>
      </div>`;
    this._knob = this.shadowRoot.querySelector('.knob');
    this._arc = this.shadowRoot.querySelector('.arc');
    this._dot = this.shadowRoot.querySelector('.dot');

    this._knob.addEventListener('pointerdown', e => {
      this._knob.setPointerCapture(e.pointerId);
      this._knob.focus(); // Safari doesn't focus divs on click — Escape-cancel needs it
      this._dragStart = { y: e.clientY, value: this.value };
    });
    this._knob.addEventListener('pointermove', e => {
      if (!this._dragStart) return;
      const { min, max, step } = this._bounds();
      const dv = ((this._dragStart.y - e.clientY) / DRAG_RANGE_PX) * (max - min);
      const next = Math.min(max, Math.max(min,
        min + Math.round((this._dragStart.value + dv - min) / step) * step));
      if (next !== this.value) {
        this.setAttribute('value', String(next));
        this.dispatchEvent(new CustomEvent('input', {
          bubbles: true, composed: true, detail: { value: next }
        }));
      }
    });
    const endDrag = () => {
      if (!this._dragStart) return;
      const start = this._dragStart.value;
      this._dragStart = null;
      if (this.value !== start) {
        this.dispatchEvent(new CustomEvent('change', {
          bubbles: true, composed: true, detail: { value: this.value }
        }));
      }
    };
    this._knob.addEventListener('pointerup', endDrag);
    this._knob.addEventListener('pointercancel', endDrag);

    this._knob.addEventListener('keydown', e => {
      const { min, max, step } = this._bounds();
      let next = null;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') next = this.value + step;
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next = this.value - step;
      if (e.key === 'Home') next = min;
      if (e.key === 'End') next = max;
      if (e.key === 'Escape' && this._dragStart) {
        this.setAttribute('value', String(this._dragStart.value));
        this._dragStart = null;
        e.preventDefault();
        return;
      }
      if (next === null) return;
      next = Math.min(max, Math.max(min, next));
      if (next !== this.value) {
        this.setAttribute('value', String(next));
        this.dispatchEvent(new CustomEvent('change', {
          bubbles: true, composed: true, detail: { value: next }
        }));
      }
      e.preventDefault();
    });

    this._sync();
  }

  _bounds() {
    // getAttribute(null) coerces to 0 via Number() — treat ABSENT as absent,
    // not zero, so the documented defaults (0/100/1) actually apply.
    const minAttr = this.getAttribute('min');
    const maxAttr = this.getAttribute('max');
    const min = minAttr === null ? 0 : Number(minAttr);
    const max = maxAttr === null ? 100 : Number(maxAttr);
    const step = Number(this.getAttribute('step'));
    return {
      min: Number.isFinite(min) ? min : 0,
      max: Number.isFinite(max) ? max : 100,
      step: Number.isFinite(step) && step > 0 ? step : 1
    };
  }

  _sync() {
    const { min, max } = this._bounds();
    const raw = Number(this.getAttribute('value'));
    this._value = Number.isNaN(raw) ? min : Math.min(max, Math.max(min, raw));
    const frac = max > min ? (this._value - min) / (max - min) : 0;
    this._arc.setAttribute('stroke-dasharray',
      `${this._circumference * SWEEP * frac} ${this._circumference}`);
    this._dot.style.setProperty('--ang', `${-135 + frac * 270}deg`);
    this._knob.setAttribute('aria-label', this.getAttribute('label') || 'Knob');
    this._knob.setAttribute('aria-valuemin', String(min));
    this._knob.setAttribute('aria-valuemax', String(max));
    this._knob.setAttribute('aria-valuenow', String(this._value));
    this._internals.setFormValue(String(this._value));
  }
}

customElements.define('ax-knob', AxKnob);
