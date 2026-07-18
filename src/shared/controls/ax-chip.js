/**
 * <ax-chip tone="ongoing|complete|neutral">On Going</ax-chip>
 * Status pill. Tone is never color-alone: `complete` carries a check glyph
 * and the slotted label always names the state.
 */
import { BaseComponent } from '@shared/base-component.js';

const CSS = `
  :host { display: inline-flex; }
  .chip {
    display: inline-flex; align-items: center; gap: 0.35em;
    padding: 0.3em 0.9em; border-radius: 999px;
    font-size: var(--text-xs); font-weight: 600; letter-spacing: 0.02em;
    color: #fff;
    transition: background var(--duration-fast) var(--ease-out-soft),
      color var(--duration-fast) var(--ease-out-soft);
  }
  .chip.ongoing { background: var(--color-primary); }
  .chip.complete { background: var(--success-color); }
  .chip.neutral { background: var(--glass-tile); color: var(--color-foreground);
    border: 1px solid var(--glass-tile-border); }
  .check { display: none; }
  .chip.complete .check { display: inline; }
`;

const TONES = ['ongoing', 'complete', 'neutral'];

export class AxChip extends BaseComponent {
  static observedAttributes = ['tone'];

  constructor() {
    super();
    this.addStyles(CSS);
  }

  attributeChangedCallback() {
    if (this._chip) this._sync();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <span class="chip" part="chip">
        <span class="check" aria-hidden="true">&check;</span>
        <slot></slot>
      </span>`;
    this._chip = this.shadowRoot.querySelector('.chip');
    this._sync();
  }

  _sync() {
    const tone = TONES.includes(this.getAttribute('tone')) ? this.getAttribute('tone') : 'neutral';
    this._chip.classList.remove(...TONES);
    this._chip.classList.add(tone);
  }
}

customElements.define('ax-chip', AxChip);
