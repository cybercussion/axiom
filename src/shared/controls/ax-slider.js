/**
 * <ax-slider> — styled range with filled track, springy thumb, value bubble.
 * Native <input type="range"> underneath: keyboard, touch drag, ARIA for free.
 */
import { BaseComponent } from '@shared/base-component.js';

const CSS = `
  :host { display: block; width: 100%; min-width: 120px; }
  :host([disabled]) { opacity: 0.5; pointer-events: none; }
  .wrap { position: relative; display: flex; align-items: center; min-height: 44px; }
  input[type="range"] {
    -webkit-appearance: none; appearance: none;
    width: 100%; height: 44px; margin: 0;
    background: transparent; cursor: pointer;
    touch-action: none;
  }
  input:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: 999px; }
  /* Glass pill rail — matches the ax-barchart mark language, not the stock thin bar. */
  input::-webkit-slider-runnable-track {
    height: 14px; border-radius: 999px;
    background: linear-gradient(to right,
      var(--color-primary) var(--fill, 0%), var(--control-track) var(--fill, 0%));
  }
  input::-webkit-slider-thumb {
    -webkit-appearance: none; width: 24px; height: 24px; margin-top: -5px;
    border-radius: 50%; background: #fff;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    transition: transform var(--duration-fast) var(--ease-spring);
  }
  input:active::-webkit-slider-thumb { transform: scale(1.2); }
  input::-moz-range-track { height: 14px; border-radius: 999px; background: var(--control-track); }
  input::-moz-range-progress { height: 14px; border-radius: 999px; background: var(--color-primary); }
  input::-moz-range-thumb {
    width: 24px; height: 24px; border: none; border-radius: 50%; background: #fff;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    transition: transform var(--duration-fast) var(--ease-spring);
  }
  input:active::-moz-range-thumb { transform: scale(1.2); }
  .bubble {
    position: absolute; bottom: calc(100% - 6px); left: var(--fill, 0%);
    transform: translateX(-50%) scale(0.8);
    background: var(--dock-bg); border: 1px solid var(--dock-border);
    color: var(--color-foreground); font-size: var(--text-xs);
    padding: 2px 8px; border-radius: 8px; pointer-events: none; white-space: nowrap;
    opacity: 0;
    transition: opacity var(--duration-fast) var(--ease-out-soft),
      transform var(--duration-fast) var(--ease-spring);
  }
  .wrap.interacting .bubble { opacity: 1; transform: translateX(-50%) scale(1); }

  /* ===== variant="fill" — control-center style: the track IS the control.
     Value reads from the fill's rounded leading edge; no floating knob.
     Fill color overridable via --ax-slider-fill (white-on-glass default
     works both themes because the rail carries the contrast). ===== */
  :host([variant="fill"]) .wrap { min-height: 48px; }
  :host([variant="fill"]) input[type="range"] { height: 48px; }
  :host([variant="fill"]) input::-webkit-slider-runnable-track {
    height: 48px; border-radius: 999px;
    background: linear-gradient(to right,
      var(--ax-slider-fill, rgba(255, 255, 255, 0.9)) var(--fill, 0%),
      var(--control-track) var(--fill, 0%));
  }
  :host([variant="fill"]) input::-webkit-slider-thumb {
    width: 24px; height: 48px; margin-top: 0;
    background: transparent; box-shadow: none; border-radius: 999px;
  }
  :host([variant="fill"]) input:active::-webkit-slider-thumb { transform: none; }
  :host([variant="fill"]) input::-moz-range-track {
    height: 48px; border-radius: 999px; background: var(--control-track);
  }
  :host([variant="fill"]) input::-moz-range-progress {
    height: 48px; border-radius: 999px;
    background: var(--ax-slider-fill, rgba(255, 255, 255, 0.9));
  }
  :host([variant="fill"]) input::-moz-range-thumb {
    width: 24px; height: 48px; background: transparent; box-shadow: none; border: none;
  }
  :host([variant="fill"]) input:active::-moz-range-thumb { transform: none; }
  .track-icon {
    position: absolute; left: 16px; top: 50%; translate: 0 -50%;
    display: none; align-items: center; pointer-events: none;
    /* Dark icon: it sits on the white fill except at near-zero values. */
    color: #333;
  }
  .track-icon ::slotted(svg) { width: 18px; height: 18px; }
  :host([variant="fill"]) .track-icon { display: inline-flex; }
`;

export class AxSlider extends BaseComponent {
  static formAssociated = true;
  static observedAttributes = ['value', 'disabled', 'label'];

  constructor() {
    super();
    this._internals = this.attachInternals();
    this.addStyles(CSS);
  }

  get value() { return Number(this._input ? this._input.value : this.getAttribute('value') || 0); }
  set value(v) {
    if (this._input) { this._input.value = v; this._sync(); }
    else this.setAttribute('value', v);
  }

  attributeChangedCallback(name) {
    if (!this._input) return;
    if (name === 'value') this._input.value = this.getAttribute('value');
    if (name === 'disabled') this._input.disabled = this.hasAttribute('disabled');
    if (name === 'label') this._input.setAttribute('aria-label', this.getAttribute('label') || 'Slider');
    this._sync();
  }

  render() {
    const min = this.getAttribute('min') ?? 0;
    const max = this.getAttribute('max') ?? 100;
    const step = this.getAttribute('step') ?? 1;
    const value = this.getAttribute('value') ?? min;
    this.shadowRoot.innerHTML = `
      <div class="wrap" part="wrap">
        <span class="track-icon" part="icon"><slot name="icon"></slot></span>
        <input type="range" part="input" min="${Number(min)}" max="${Number(max)}"
          step="${Number(step)}" value="${Number(value)}"
          aria-label="${this._esc(this.getAttribute('label') || 'Slider')}">
        <output class="bubble" part="bubble" aria-hidden="true"></output>
      </div>`;
    this._input = this.shadowRoot.querySelector('input');
    this._wrap = this.shadowRoot.querySelector('.wrap');
    this._bubble = this.shadowRoot.querySelector('.bubble');
    this._input.disabled = this.hasAttribute('disabled');

    // Native input events are composed — they'd escape the shadow root and
    // reach consumers WITHOUT detail, alongside our CustomEvent. Swallow the
    // native ones so consumers only ever see events carrying detail.value.
    this._input.addEventListener('input', (e) => {
      e.stopPropagation();
      this._sync();
      this.dispatchEvent(new CustomEvent('input', {
        bubbles: true, composed: true, detail: { value: this.value }
      }));
    });
    this._input.addEventListener('change', (e) => {
      e.stopPropagation();
      this.dispatchEvent(new CustomEvent('change', {
        bubbles: true, composed: true, detail: { value: this.value }
      }));
    });
    const start = () => this._wrap.classList.add('interacting');
    const stop = () => this._wrap.classList.remove('interacting');
    this._input.addEventListener('pointerdown', start);
    this._input.addEventListener('pointerup', stop);
    this._input.addEventListener('pointercancel', stop);
    this._input.addEventListener('focus', start);
    this._input.addEventListener('blur', stop);
    this._sync();
  }

  _sync() {
    const min = Number(this._input.min), max = Number(this._input.max);
    const pct = max > min ? ((this.value - min) / (max - min)) * 100 : 0;
    this._wrap.style.setProperty('--fill', `${pct}%`);
    this._bubble.textContent = String(this.value);
    this._internals.setFormValue(this.hasAttribute('disabled') ? null : String(this.value));
  }
}

customElements.define('ax-slider', AxSlider);
