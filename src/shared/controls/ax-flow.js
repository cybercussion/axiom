/**
 * <ax-flow sources='[{"label":"A","value":10}]' sinks='[...]' unit="$" label="Sales flow">
 * Two-sided flow (constrained Sankey): sources fan into a center hub, sinks
 * fan out the other side. Color encodes SIDE (--chart-1 sources, --chart-4
 * sinks) — identity is carried by the always-visible labels, never color
 * alone (dataviz method). Display control: no events; hover dims siblings;
 * the sr-only summary is the accessible surface (SVG is aria-hidden).
 */
import { BaseComponent } from '@shared/base-component.js';
import { log } from '@core/logger.js';

const VB_W = 720, VB_H = 340;
const CX = VB_W / 2, CY = VB_H / 2;
const HUB_R = 64, ORBIT_R = 84;
const OUTER_X_SRC = 150, OUTER_X_SNK = VB_W - 150;
const HUB_X_SRC = CX - HUB_R, HUB_X_SNK = CX + HUB_R;
const GAP = 2;          // hub-side spacer (method rule)
const OUTER_GAP = 28;   // outer spread — the wide→tight convergence IS the fan.
                        // Must exceed the ~27px two-line label block so thin
                        // adjacent ribbons never collide their labels (pitch =
                        // h + OUTER_GAP ≥ 30). Outer span always fits: hub
                        // thickness budget caps sumH at 162 (~168 with MIN_H
                        // flooring under extreme skew), +3×28 ≤ 252 < 340.
const STACK_MAX = 168;  // hub-side stack budget (thickness + gaps)
const MAX_PER_SIDE = 4; // beyond this, fold to Other
const MIN_H = 2;
const LABEL_TRUNC = 14;
const r2 = v => Math.round(v * 100) / 100;

const CSS = `
  :host { display: block; position: relative; }
  svg { width: 100%; height: auto; display: block; }
  .orbit { fill: none; stroke: var(--color-muted); stroke-dasharray: 3 6; opacity: 0.35; }
  .stop-solid-src { stop-color: var(--chart-1); }
  .stop-light-src { stop-color: color-mix(in srgb, var(--chart-1) 55%, white); }
  .stop-solid-snk { stop-color: var(--chart-4); }
  .stop-light-snk { stop-color: color-mix(in srgb, var(--chart-4) 55%, white); }
  .side {
    opacity: 0; transform: scaleX(0.9);
    transform-box: view-box; transform-origin: 50% 50%;
    transition: opacity var(--duration-slow) var(--ease-out-soft),
      transform var(--duration-slow) var(--ease-out-soft);
  }
  .labels { opacity: 0; transition: opacity var(--duration-slow) var(--ease-out-soft); }
  :host([data-ready]) .side { opacity: 1; transform: none; }
  :host([data-ready]) .labels { opacity: 1; }
  .ribbon { transition: opacity var(--duration-fast) var(--ease-out-soft); }
  .flows:hover .ribbon { opacity: 0.35; }
  .flows:hover .ribbon:hover { opacity: 1; }
  .lbl { font-size: 12px; fill: var(--color-muted); font-family: inherit; }
  .val { font-size: 13px; font-weight: 600; fill: var(--color-foreground); font-family: inherit; }
  .hub {
    position: absolute; left: 50%; top: 50%;
    transform: translate(-50%, -50%);
    width: 17.8%; aspect-ratio: 1; border-radius: 50%;
    background: var(--glass-tile);
    border: 1px solid var(--glass-tile-border);
  }
  :host([surface="neu"]) .hub {
    background: var(--neu-surface-deep); border: none;
    box-shadow: var(--neu-well);
  }
  .hub-slot {
    position: absolute; left: 50%; top: 50%;
    transform: translate(-50%, -50%);
    width: 16%; text-align: center; pointer-events: none;
    display: flex; flex-direction: column; align-items: center; gap: 2px;
  }
`;

export class AxFlow extends BaseComponent {
  static observedAttributes = ['sources', 'sinks', 'unit', 'label'];

  constructor() {
    super();
    this._internals = this.attachInternals();
    this._internals.role = 'group';
    this.addStyles(CSS);
    this._sources = [];
    this._sinks = [];
  }

  get sources() { return this._sources; }
  set sources(list) {
    this._srcPropSet = true; // explicit property assignment permanently wins over the attribute
    this._sources = this._clean(list);
    if (this._svg) this._draw();
  }

  get sinks() { return this._sinks; }
  set sinks(list) {
    this._snkPropSet = true;
    this._sinks = this._clean(list);
    if (this._svg) this._draw();
  }

  attributeChangedCallback(name) {
    if (!this._svg) return;
    if (name === 'sources') { if (!this._srcPropSet) { this._sources = this._parse('sources'); this._draw(); } }
    else if (name === 'sinks') { if (!this._snkPropSet) { this._sinks = this._parse('sinks'); this._draw(); } }
    else this._draw(); // unit / label
  }

  _clean(list) {
    if (!Array.isArray(list)) return [];
    const ok = list
      .filter(d => d && typeof d.label === 'string'
        && Number.isFinite(Number(d.value)) && Number(d.value) >= 0)
      .map(d => ({ label: d.label, value: Number(d.value) }));
    if (ok.length !== list.length) log.warn('[ax-flow] Dropped invalid entries');
    return ok;
  }

  _parse(attr) {
    try { return this._clean(JSON.parse(this.getAttribute(attr) || '[]')); }
    catch (e) { log.warn(`[ax-flow] Bad ${attr} JSON`, e); return []; }
  }

  _fold(list) {
    if (list.length <= MAX_PER_SIDE) return list;
    const sorted = [...list].sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, MAX_PER_SIDE - 1);
    const rest = sorted.slice(MAX_PER_SIDE - 1).reduce((s, d) => s + d.value, 0);
    return [...top, { label: 'Other', value: rest }];
  }

  render() {
    this.shadowRoot.innerHTML = `
      <svg viewBox="0 0 ${VB_W} ${VB_H}" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="g-src" gradientUnits="userSpaceOnUse"
            x1="${OUTER_X_SRC}" y1="0" x2="${HUB_X_SRC}" y2="0">
            <stop offset="0" class="stop-solid-src"></stop>
            <stop offset="1" class="stop-light-src"></stop>
          </linearGradient>
          <linearGradient id="g-snk" gradientUnits="userSpaceOnUse"
            x1="${OUTER_X_SNK}" y1="0" x2="${HUB_X_SNK}" y2="0">
            <stop offset="0" class="stop-solid-snk"></stop>
            <stop offset="1" class="stop-light-snk"></stop>
          </linearGradient>
        </defs>
        <circle class="orbit" cx="${CX}" cy="${CY}" r="${ORBIT_R}"></circle>
        <g class="flows">
          <g class="side side-src"></g>
          <g class="side side-snk"></g>
        </g>
        <g class="labels"></g>
      </svg>
      <div class="hub" part="hub" aria-hidden="true"></div>
      <div class="hub-slot" part="hub-slot"><slot></slot></div>
      <div class="sr-only summary"></div>`;
    this._svg = this.shadowRoot.querySelector('svg');
    if (!this._srcPropSet) this._sources = this._parse('sources');
    if (!this._snkPropSet) this._sinks = this._parse('sinks');
    this._draw();
  }

  /* Thickness is set ONCE from the hub-side budget (constant along the
     ribbon); only the stacking gap differs between ends — the wide outer
     stack converging into the tight hub stack produces the fan. */
  _layout(list) {
    const total = list.reduce((s, d) => s + d.value, 0);
    if (!total) return [];
    const n = list.length;
    const scale = (STACK_MAX - (n - 1) * GAP) / total;
    const hs = list.map(d => Math.max(MIN_H, d.value * scale));
    const sumH = hs.reduce((s, h) => s + h, 0);
    let yHub = CY - (sumH + (n - 1) * GAP) / 2;
    let yOut = CY - (sumH + (n - 1) * OUTER_GAP) / 2;
    return list.map((d, i) => {
      const row = { ...d, h: hs[i], yHub, yOut };
      yHub += hs[i] + GAP;
      yOut += hs[i] + OUTER_GAP;
      return row;
    });
  }

  _path(x0, y0, x1, y1, h) {
    const mx = r2((x0 + x1) / 2);
    return `M ${x0} ${y0} C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`
      + ` L ${x1} ${r2(y1 + h)} C ${mx} ${r2(y1 + h)}, ${mx} ${r2(y0 + h)}, ${x0} ${r2(y0 + h)} Z`;
  }

  _ribbons(rows, side) {
    const x0 = side === 'src' ? OUTER_X_SRC : OUTER_X_SNK;
    const x1 = side === 'src' ? HUB_X_SRC : HUB_X_SNK;
    const unit = this.getAttribute('unit') || '';
    return rows.map(d => `
      <path class="ribbon" fill="url(#g-${side})"
        d="${this._path(x0, r2(d.yOut), x1, r2(d.yHub), d.h)}">
        <title>${this._esc(d.label)}: ${this._esc(unit)}${d.value.toLocaleString()}</title>
      </path>`).join('');
  }

  _labels(rows, side, unit) {
    const anchor = side === 'src' ? 'end' : 'start';
    const x = side === 'src' ? OUTER_X_SRC - 10 : OUTER_X_SNK + 10;
    return rows.map(d => {
      const cy = d.yOut + d.h / 2;
      const name = d.label.length > LABEL_TRUNC
        ? d.label.slice(0, LABEL_TRUNC - 1) + '…' : d.label;
      return `
      <text class="lbl" x="${x}" y="${r2(cy - 3)}" text-anchor="${anchor}">${this._esc(name)}</text>
      <text class="val" x="${x}" y="${r2(cy + 12)}" text-anchor="${anchor}">${this._esc(unit)}${d.value.toLocaleString()}</text>`;
    }).join('');
  }

  _summary(srcs, snks, unit) {
    const el = this.shadowRoot.querySelector('.summary');
    const fmt = d => `${this._esc(d.label)} (${this._esc(unit)}${d.value.toLocaleString()})`;
    const tot = arr => arr.reduce((s, d) => s + d.value, 0);
    const max = arr => arr.reduce((m, d) => (d.value > (m?.value ?? -1) ? d : m), null);
    const bits = [
      `${this._esc(this.getAttribute('label') || 'Flow chart')}: `
      + `${srcs.length} sources totaling ${this._esc(unit)}${tot(srcs).toLocaleString()} `
      + `flow to ${snks.length} sinks totaling ${this._esc(unit)}${tot(snks).toLocaleString()}.`
    ];
    if (srcs.length) bits.push(`Largest source: ${fmt(max(srcs))}.`);
    if (snks.length) bits.push(`Largest sink: ${fmt(max(snks))}.`);
    el.innerHTML = `<p>${bits.join(' ')}</p><ul>${[
      ...srcs.map(d => `<li>Source ${fmt(d)}</li>`),
      ...snks.map(d => `<li>Sink ${fmt(d)}</li>`)
    ].join('')}</ul>`;
  }

  _draw() {
    const unit = this.getAttribute('unit') || '';
    this._internals.ariaLabel = this.getAttribute('label') || 'Flow chart';
    const srcs = this._fold(this._sources);
    const snks = this._fold(this._sinks);
    const sRows = this._layout(srcs);
    const kRows = this._layout(snks);
    this.removeAttribute('data-ready'); // reset so the entrance replays on data swaps
    this._svg.querySelector('.side-src').innerHTML = this._ribbons(sRows, 'src');
    this._svg.querySelector('.side-snk').innerHTML = this._ribbons(kRows, 'snk');
    this._svg.querySelector('.labels').innerHTML =
      this._labels(sRows, 'src', unit) + this._labels(kRows, 'snk', unit);
    this._summary(srcs, snks, unit);
    // Double-rAF: commit the reset frame, then arm the entrance transition.
    requestAnimationFrame(() => requestAnimationFrame(() => this.setAttribute('data-ready', '')));
  }
}

customElements.define('ax-flow', AxFlow);
