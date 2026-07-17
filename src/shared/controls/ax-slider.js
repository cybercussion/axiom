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
  input:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: 8px; }
  input::-webkit-slider-runnable-track {
    height: 4px; border-radius: 2px;
    background: linear-gradient(to right,
      var(--color-primary) var(--fill, 0%), var(--control-track) var(--fill, 0%));
  }
  input::-webkit-slider-thumb {
    -webkit-appearance: none; width: 16px; height: 16px; margin-top: -6px;
    border-radius: 50%; background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: transform var(--duration-fast) var(--ease-spring);
  }
  input:active::-webkit-slider-thumb { transform: scale(1.4); }
  input::-moz-range-track { height: 4px; border-radius: 2px; background: var(--control-track); }
  input::-moz-range-progress { height: 4px; border-radius: 2px; background: var(--color-primary); }
  input::-moz-range-thumb {
    width: 16px; height: 16px; border: none; border-radius: 50%; background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: transform var(--duration-fast) var(--ease-spring);
  }
  input:active::-moz-range-thumb { transform: scale(1.4); }
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
