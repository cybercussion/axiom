/**
 * <ax-segment options="Eco,Normal,Boost" value="Normal" label="Power profile">
 * Single-select segmented control: a raised puck slides under the active
 * segment (dock active-pill language). Radiogroup semantics — arrows MOVE
 * AND SELECT (native radio parity), roving tabindex, equal-width segments.
 * `value` is the selected option's label (comma-list options, dipswitch
 * precedent); defaults to the first option.
 */
import { BaseComponent } from '@shared/base-component.js';
import { FormControlMixin } from './form-control-mixin.js';

const CSS = `
  :host { display: inline-flex; max-width: 100%; }
  :host([disabled]), :host([data-form-disabled]) { opacity: 0.45; pointer-events: none; }
  .group {
    position: relative; isolation: isolate;
    display: grid; grid-auto-flow: column; grid-auto-columns: 1fr;
    max-width: 100%;
    border-radius: 999px; padding: 3px;
    background: var(--control-track);
  }
  .puck {
    position: absolute; z-index: -1;
    top: 3px; bottom: 3px; left: 3px;
    width: calc((100% - 6px) / var(--seg-count, 1));
    border-radius: 999px;
    background: var(--color-primary);
    transition: transform var(--duration-base) var(--ease-spring);
  }
  .seg {
    all: unset; box-sizing: border-box; cursor: pointer;
    min-height: 44px; min-width: 44px; padding: 0 var(--space-m);
    display: flex; align-items: center; justify-content: center;
    font-size: var(--text-sm); font-weight: 600;
    color: var(--color-muted);
    transition: color var(--duration-fast) var(--ease-out-soft);
    -webkit-tap-highlight-color: transparent;
  }
  .seg span {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .seg:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: 999px; }
  .seg[aria-checked="true"] { color: #fff; }
  /* ===== surface="neu" — carved rail, raised face puck ===== */
  :host([surface="neu"]) .group {
    background: var(--neu-surface-deep);
    box-shadow: var(--neu-well);
  }
  :host([surface="neu"]) .puck {
    background: var(--neu-face);
    box-shadow: var(--neu-raised-sm);
  }
  :host([surface="neu"]) .seg[aria-checked="true"] { color: var(--color-foreground); }
`;

export class AxSegment extends FormControlMixin(BaseComponent) {
  static observedAttributes = ['options', 'value', 'label', 'disabled'];

  constructor() {
    super();
    this.addStyles(CSS);
  }

  get value() {
    const opts = this._opts();
    return opts[this._index()] ?? '';
  }
  set value(v) { this.setAttribute('value', v ?? ''); }

  attributeChangedCallback(name) {
    if (!this._group) return;
    if (name === 'options') this._build();
    else this._sync();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <div class="group" part="group" role="radiogroup">
        <span class="puck" part="puck" aria-hidden="true"></span>
      </div>`;
    this._group = this.shadowRoot.querySelector('.group');
    // Capture ONCE — render() re-runs on reconnect (see ax-select note).
    if (this._defaultValue === undefined) this._defaultValue = this.getAttribute('value');

    this._group.addEventListener('click', e => {
      const seg = e.target.closest('.seg');
      if (seg) this._select(Number(seg.dataset.i), true);
    });
    this._group.addEventListener('keydown', e => {
      const n = this._opts().length;
      if (!n) return;
      let next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (this._index() + 1) % n;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (this._index() - 1 + n) % n;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = n - 1;
      if (next === null) return;
      e.preventDefault();
      this._select(next, true);
      this._group.querySelectorAll('.seg')[next]?.focus();
    });
    this._build();
  }

  _opts() {
    return (this.getAttribute('options') || '').split(',').map(s => s.trim()).filter(Boolean);
  }

  _index() {
    const opts = this._opts();
    const i = opts.indexOf(this.getAttribute('value'));
    return i === -1 ? 0 : i;
  }

  _build() {
    const opts = this._opts();
    this._group.style.setProperty('--seg-count', String(opts.length || 1));
    this._group.querySelectorAll('.seg').forEach(el => el.remove());
    this._group.insertAdjacentHTML('beforeend', opts.map((o, i) =>
      `<button type="button" class="seg" role="radio" data-i="${i}"><span>${this._esc(o)}</span></button>`
    ).join(''));
    this._sync();
  }

  _select(i, emit) {
    const opts = this._opts();
    if (!opts.length) return;
    const clamped = Math.max(0, Math.min(opts.length - 1, i));
    const changed = clamped !== this._index();
    this.setAttribute('value', opts[clamped]);
    if (emit && changed) {
      this.dispatchEvent(new CustomEvent('change', {
        bubbles: true, composed: true, detail: { value: opts[clamped], index: clamped }
      }));
    }
  }

  _sync() {
    const opts = this._opts();
    const idx = this._index();
    this._group.setAttribute('aria-label', this.getAttribute('label') || 'Segments');
    this._group.querySelectorAll('.seg').forEach((el, i) => {
      el.setAttribute('aria-checked', String(i === idx));
      el.tabIndex = i === idx ? 0 : -1;
      el.disabled = this.hasAttribute('disabled') || this.hasAttribute('data-form-disabled');
    });
    const puck = this._group.querySelector('.puck');
    puck.style.transform = `translateX(${idx * 100}%)`;
    puck.style.display = opts.length ? '' : 'none';
    this._setFormValue(opts[idx] ?? null);
  }

  _formReset() {
    if (this._defaultValue === null) this.removeAttribute('value');
    else this.setAttribute('value', this._defaultValue);
    this._sync();
  }
}

customElements.define('ax-segment', AxSegment);
