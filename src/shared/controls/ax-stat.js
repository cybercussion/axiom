/**
 * <ax-stat value="108" unit="bpm" label="Heart Rate"> — glass stat tile.
 * Slots: icon (left chip), trend (right of value). The dataviz "not a
 * chart" form: a headline number, no hover layer.
 */
import { BaseComponent } from '@shared/base-component.js';
import { motionMs } from '@shared/motion.js';

const CSS = `
  :host { display: block; }
  /* Surface comes from the shared .glass-tile utility (adopted theme sheet);
     only layout is local, so glass-system retunes propagate automatically. */
  .tile { display: flex; align-items: center; gap: var(--space-m); }
  .icon-chip {
    flex: 0 0 auto; width: 44px; height: 44px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    background: var(--glass-tile); border: 1px solid var(--glass-tile-border);
    color: var(--color-foreground);
  }
  .icon-chip ::slotted(svg) { width: 20px; height: 20px; }
  .body { min-width: 0; }
  .value-row { display: flex; align-items: baseline; gap: var(--space-xs); }
  .value {
    font-size: var(--text-xl); font-weight: 800; color: var(--color-foreground);
    letter-spacing: -0.02em;
    transition: opacity var(--duration-fast) var(--ease-out-soft);
  }
  .value.swap { opacity: 0; }
  .unit { font-size: var(--text-sm); color: var(--color-muted); font-weight: 600; }
  .label { font-size: var(--text-xs); color: var(--color-muted); margin-top: 2px; }
  /* ===== surface="neu" — raised face card; wins over the .glass-tile utility. ===== */
  :host([surface="neu"]) .tile {
    background: var(--neu-face); border: none;
    border-radius: 14px; padding: var(--space-m);
    box-shadow: var(--neu-raised-sm);
  }
  :host([surface="neu"]) .icon-chip {
    background: var(--neu-surface-deep); border: none;
    box-shadow: var(--neu-well);
  }
`;

export class AxStat extends BaseComponent {
  static observedAttributes = ['value', 'unit', 'label'];

  constructor() {
    super();
    this.addStyles(CSS);
  }

  get value() { return this.getAttribute('value') ?? ''; }
  set value(v) { this.setAttribute('value', v); }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._value) return;
    if (name === 'value') {
      if (oldValue === newValue) return; // same-value re-set: no flicker
      // Debounce overlapping changes — only the LAST change controls the fade-in.
      clearTimeout(this._swapTimer);
      this._value.classList.add('swap');
      this._swapTimer = setTimeout(() => { // matches --duration-fast
        this._value.textContent = this.value;
        this._value.classList.remove('swap');
      }, motionMs('--duration-fast', 200));
    } else {
      this._syncText();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this._swapTimer);
  }

  render() {
    this.shadowRoot.innerHTML = `
      <div class="tile glass-tile" part="tile">
        <span class="icon-chip" part="icon"><slot name="icon"></slot></span>
        <span class="body">
          <span class="value-row">
            <span class="value"></span>
            <span class="unit"></span>
            <slot name="trend"></slot>
          </span>
          <span class="label"></span>
        </span>
      </div>`;
    this._value = this.shadowRoot.querySelector('.value');
    this._syncText();
  }

  _syncText() {
    this._value.textContent = this.value;
    this.shadowRoot.querySelector('.unit').textContent = this.getAttribute('unit') || '';
    this.shadowRoot.querySelector('.label').textContent = this.getAttribute('label') || '';
  }
}

customElements.define('ax-stat', AxStat);
