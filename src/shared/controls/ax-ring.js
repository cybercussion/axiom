/**
 * <ax-ring size="160"> — segmented glass donut. Segments render in fixed
 * --chart-N slot order (never cycled); >4 folds into "Other". 2px gaps,
 * rounded caps, sequential sweep-in. Center content is slotted.
 */
import { BaseComponent } from '@shared/base-component.js';

const STROKE = 12;
const GAP_PX = 2;
// Round caps bulge STROKE/2 past each dash end — the path-length gap must
// absorb both bulges for GAP_PX of visible rail between segments.
const PATH_GAP = STROKE + GAP_PX;
const MAX_SEGMENTS = 4;

const CSS = `
  :host { display: inline-flex; flex-direction: column; align-items: center; gap: var(--space-s); }
  .stage { position: relative; }
  svg { display: block; transform: rotate(-90deg); }
  .rail { stroke: var(--control-track); fill: none; }
  .seg {
    fill: none; stroke-linecap: round; cursor: pointer;
    transition: stroke-dasharray var(--duration-slow) var(--ease-cinematic),
      opacity var(--duration-fast) var(--ease-out-soft);
  }
  .stage:hover .seg:not(:hover) { opacity: 0.45; }
  .center {
    position: absolute; inset: ${STROKE + 4}px; display: flex;
    flex-direction: column; align-items: center; justify-content: center;
    text-align: center; pointer-events: none;
  }
  .legend { display: flex; flex-direction: column; gap: var(--space-2xs); }
  .legend-row {
    display: flex; align-items: center; gap: var(--space-xs);
    font-size: var(--text-xs); color: var(--color-muted);
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 8px; }
  .legend-value { color: var(--color-foreground); font-weight: 600; }
  .tip {
    position: absolute; top: -6px; left: 50%; transform: translate(-50%, -100%) scale(0.9);
    background: var(--dock-bg); border: 1px solid var(--dock-border);
    color: var(--color-foreground); font-size: var(--text-xs);
    padding: 2px 8px; border-radius: 8px; white-space: nowrap;
    opacity: 0; pointer-events: none;
    transition: opacity var(--duration-fast) var(--ease-out-soft),
      transform var(--duration-fast) var(--ease-spring);
  }
  .tip.show { opacity: 1; transform: translate(-50%, -100%) scale(1); }
  /* ===== surface="neu" — circular carved backdrop; segments stay --chart-N,
     no per-segment glow (restraint). ===== */
  :host([surface="neu"]) .stage { isolation: isolate; }
  :host([surface="neu"]) .stage::before {
    content: ''; position: absolute; inset: -12px; border-radius: 50%;
    background: var(--neu-surface-deep); box-shadow: var(--neu-well);
    z-index: -1;
  }
  :host([surface="neu"]) .rail {
    stroke: color-mix(in srgb, black 25%, var(--neu-surface-deep));
  }
`;

export class AxRing extends BaseComponent {
  constructor() {
    super();
    this._segments = [];
    this.addStyles(CSS);
    // Delegated hover/focus tooltip — attach once per instance.
    this.shadowRoot.addEventListener('pointerover', e => this._tipFor(e.target));
    this.shadowRoot.addEventListener('pointerout', () => this._tipFor(null));
    this.shadowRoot.addEventListener('focusin', e => this._tipFor(e.target));
    this.shadowRoot.addEventListener('focusout', () => this._tipFor(null));
  }

  static observedAttributes = ['segments'];

  get segments() { return this._segments; }
  set segments(arr) {
    this._propSet = true; // explicit property assignment permanently wins over the attribute
    this._applySegments(arr);
  }

  attributeChangedCallback(name) {
    if (!this._svg) return;
    if (name === 'segments' && !this._propSet) this._parseAttr();
  }

  _parseAttr() {
    try { this._applySegments(JSON.parse(this.getAttribute('segments') || '[]')); }
    catch { this._applySegments([]); }
  }

  _applySegments(arr) {
    const clean = (Array.isArray(arr) ? arr : [])
      .filter(s => s && Number(s.value) > 0)
      .map(s => ({ label: String(s.label ?? ''), value: Number(s.value) }));
    // Fixed-order rule: >MAX folds the tail into "Other" (slot 4), no hue cycling.
    this._segments = clean.length > MAX_SEGMENTS
      ? [...clean.slice(0, MAX_SEGMENTS - 1),
         { label: 'Other', value: clean.slice(MAX_SEGMENTS - 1).reduce((a, s) => a + s.value, 0) }]
      : clean;
    if (this._svg) this._draw();
  }

  render() {
    const size = Number(this.getAttribute('size')) > 0 ? Number(this.getAttribute('size')) : 160;
    this._size = size;
    this.shadowRoot.innerHTML = `
      <div class="stage" part="stage">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
          role="group" aria-label="${this._esc(this.getAttribute('label') || 'Ring chart')}"></svg>
        <div class="center" part="center"><slot></slot></div>
        <div class="tip" aria-hidden="true"></div>
      </div>
      <slot name="legend"><div class="legend" part="legend"></div></slot>
      <span class="sr-only" data-summary></span>`;
    this._svg = this.shadowRoot.querySelector('svg');
    this._tip = this.shadowRoot.querySelector('.tip');
    if (!this._propSet && this.getAttribute('segments')) this._parseAttr();
    else this._draw();
  }

  _draw() {
    this._tip?.classList.remove('show');
    const size = this._size, r = (size - STROKE) / 2, mid = size / 2;
    const c = 2 * Math.PI * r;
    const segs = this._segments;
    const total = segs.reduce((a, s) => a + s.value, 0);
    const gaps = segs.length > 1 ? segs.length * PATH_GAP : 0;
    const usable = c - gaps;

    let svg = `<circle class="rail" cx="${mid}" cy="${mid}" r="${r}" stroke-width="${STROKE}"></circle>`;
    let offset = 0;
    segs.forEach((s, i) => {
      const len = total > 0 ? Math.max(0, (s.value / total) * usable) : 0;
      svg += `<circle class="seg" data-i="${i}" tabindex="0" cx="${mid}" cy="${mid}" r="${r}"
        stroke-width="${STROKE}" stroke="var(--chart-${i + 1})"
        stroke-dasharray="0 ${c}" stroke-dashoffset="${-offset}"
        style="transition-delay: calc(var(--duration-fast) * ${i})"
        data-len="${len}" data-rest="${c - len}"
        aria-label="${this._esc(s.label)}: ${s.value}"></circle>`;
      offset += len + (segs.length > 1 ? PATH_GAP : 0);
    });
    this._svg.innerHTML = svg;

    // Sweep in: dasharray 0→len after the initial state commits.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this._svg.querySelectorAll('.seg').forEach(el => {
        el.setAttribute('stroke-dasharray', `${el.dataset.len} ${el.dataset.rest}`);
      });
    }));

    // Built-in legend (suppressed for <2 segments per the single-series rule).
    const legend = this.shadowRoot.querySelector('.legend');
    if (legend) {
      legend.innerHTML = segs.length >= 2 ? segs.map((s, i) => `
        <span class="legend-row">
          <span class="dot" style="background: var(--chart-${i + 1})"></span>
          <span>${this._esc(s.label)}</span>
          <span class="legend-value">${s.value}</span>
        </span>`).join('') : '';
    }
    this.shadowRoot.querySelector('[data-summary]').textContent =
      segs.map(s => `${s.label}: ${s.value}`).join(', ');
  }

  _tipFor(target) {
    const seg = target?.classList?.contains('seg') ? target : null;
    if (!seg) { this._tip?.classList.remove('show'); return; }
    const s = this._segments[Number(seg.dataset.i)];
    if (!s) return;
    this._tip.textContent = `${s.label}: ${s.value}`;
    this._tip.classList.add('show');
  }
}

customElements.define('ax-ring', AxRing);
