/**
 * <ax-barchart unit="%"> + el.data = [{label:'Sun', value:23}, ...]
 * Rounded pill columns on --control-track rails. Bars grow from the
 * baseline with a staggered spring; labels are selective (>= 60% of max,
 * plus first and last); every bar is focusable for the tooltip.
 */
import { BaseComponent } from '@shared/base-component.js';

const CSS = `
  :host { display: block; }
  .chart { display: flex; gap: var(--space-xs); align-items: stretch; height: 160px; position: relative; }
  .col { flex: 1; display: flex; flex-direction: column; gap: var(--space-2xs); min-width: 0; }
  .rail {
    position: relative; flex: 1; border-radius: 999px;
    background: var(--control-track); overflow: hidden;
    cursor: pointer; outline-offset: 2px;
  }
  .rail:focus-visible { outline: 2px solid var(--color-primary); }
  .fill {
    position: absolute; left: 0; right: 0; bottom: 0; height: 0;
    border-radius: 999px; background: var(--chart-1);
    transition: height var(--duration-slow) var(--ease-spring);
  }
  .val {
    position: absolute; top: 8px; left: 0; right: 0; text-align: center;
    font-size: var(--text-xs); font-weight: 600; color: var(--color-foreground);
    opacity: 0; transition: opacity var(--duration-base) var(--ease-out-soft);
  }
  .val.show { opacity: 1; }
  .day { text-align: center; font-size: var(--text-xs); color: var(--color-muted); }
  .tip {
    position: absolute; transform: translate(-50%, -100%) scale(0.9);
    background: var(--dock-bg); border: 1px solid var(--dock-border);
    color: var(--color-foreground); font-size: var(--text-xs);
    padding: 2px 8px; border-radius: 8px; white-space: nowrap;
    opacity: 0; pointer-events: none; z-index: 1;
    transition: opacity var(--duration-fast) var(--ease-out-soft),
      transform var(--duration-fast) var(--ease-spring);
  }
  .tip.show { opacity: 1; transform: translate(-50%, -100%) scale(1); }
`;

export class AxBarchart extends BaseComponent {
  static observedAttributes = ['data', 'max', 'unit', 'label'];

  constructor() {
    super();
    this._data = [];
    this.addStyles(CSS);
    this.shadowRoot.addEventListener('pointerover', e => this._tipFor(e.target));
    this.shadowRoot.addEventListener('pointerout', () => this._tipFor(null));
    this.shadowRoot.addEventListener('focusin', e => this._tipFor(e.target));
    this.shadowRoot.addEventListener('focusout', () => this._tipFor(null));
  }

  get data() { return this._data; }
  set data(arr) {
    this._propSet = true; // explicit property assignment permanently wins over the attribute
    this._applyData(arr);
  }

  _applyData(arr) {
    this._data = (Array.isArray(arr) ? arr : [])
      .filter(d => d && !Number.isNaN(Number(d.value)))
      .map(d => ({ label: String(d.label ?? ''), value: Number(d.value) }));
    if (this._chart) this._draw();
  }

  attributeChangedCallback(name) {
    if (!this._chart) return;
    if (name === 'data') { if (!this._propSet) this._parseAttr(); }
    else this._draw();
  }

  _parseAttr() {
    try { this._applyData(JSON.parse(this.getAttribute('data') || '[]')); }
    catch { this._applyData([]); }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <div class="chart" part="chart" role="group"
        aria-label="${this._esc(this.getAttribute('label') || 'Bar chart')}"></div>
      <span class="sr-only" data-summary></span>`;
    this._chart = this.shadowRoot.querySelector('.chart');
    if (!this._propSet && this.getAttribute('data')) this._parseAttr();
    else this._draw();
  }

  _draw() {
    this._chart.setAttribute('aria-label', this._esc(this.getAttribute('label') || 'Bar chart'));
    const unit = this.getAttribute('unit') || '';
    const attrMax = Number(this.getAttribute('max'));
    const max = attrMax > 0 ? attrMax : Math.max(1, ...this._data.map(d => d.value));
    this._chart.innerHTML = this._data.map((d, i) => {
      const pct = Math.min(100, Math.max(0, (d.value / max) * 100));
      // Selective labels: >= 60% of max, plus first and last bar.
      const labeled = pct >= 60 || i === 0 || i === this._data.length - 1;
      return `
      <div class="col">
        <div class="rail" tabindex="0" data-i="${i}"
          aria-label="${this._esc(d.label)}: ${d.value}${this._esc(unit)}">
          <span class="val ${labeled ? 'show' : ''}" aria-hidden="true">${d.value}${this._esc(unit)}</span>
          <div class="fill" data-h="${pct}" style="transition-delay: calc(var(--duration-instant) * ${i} * 0.4)"></div>
        </div>
        <span class="day">${this._esc(d.label)}</span>
      </div>`;
    }).join('') + `<div class="tip" aria-hidden="true"></div>`;
    this._tip = this.shadowRoot.querySelector('.tip');

    // Grow-in after initial 0-height commits (staggered by the inline delays).
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this._chart.querySelectorAll('.fill').forEach(f => { f.style.height = `${f.dataset.h}%`; });
    }));

    this.shadowRoot.querySelector('[data-summary]').textContent =
      this._data.map(d => `${d.label}: ${d.value}${unit}`).join(', ');
  }

  _tipFor(target) {
    const rail = target?.classList?.contains('rail') ? target : target?.closest?.('.rail');
    if (!rail || !this._tip) { this._tip?.classList.remove('show'); return; }
    const d = this._data[Number(rail.dataset.i)];
    if (!d) return;
    const unit = this.getAttribute('unit') || '';
    this._tip.textContent = `${d.label}: ${d.value}${unit}`;
    this._tip.style.left = `${rail.offsetLeft + rail.offsetWidth / 2}px`;
    this._tip.style.top = `${rail.offsetTop - 4}px`;
    this._tip.classList.add('show');
  }
}

customElements.define('ax-barchart', AxBarchart);
