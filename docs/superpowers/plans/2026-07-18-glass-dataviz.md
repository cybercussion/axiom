# Glass Data-Viz Component Set — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seven glassmorphism data-viz `ax-*` components + a two-level glass surface system + a validated chart palette, demonstrated by rebuilding `/dashboard` as the flagship glass composition.

**Architecture:** HTML/CSS marks with SVG only for arcs; every component is a dumb `BaseComponent` subclass in `src/shared/controls/` (data in via property/attribute, events out composed, no `@state`), themed exclusively by tokens, animated exclusively by the motion tokens (reduced-motion collapse inherited). Chart colors are frozen as theme tokens ONLY because they passed the dataviz six-check validator on both theme surfaces.

**Tech Stack:** Vanilla ES modules, Web Components/Shadow DOM, inline SVG, CSS custom properties. Zero dependencies. Spec: `docs/superpowers/specs/2026-07-18-glass-dataviz-design.md`.

**Testing model:** Same as the motion plan — no browser test runner; per-task gates are `node --check`, the motion grep gates, and controller-driven browser verification at milestones. The palette gate (Task 1) is machine-checked with the dataviz validator.

## Global Constraints

- Motion tokens only (`var(--duration-*)`, `var(--ease-*)`); no literal easings/durations except tagged infinite loops (`/* motion-gate: allow */`). Grep gates must stay clean.
- Dumb components: never import `@state`; events `bubbles: true, composed: true`; `_esc()` on interpolated text; once-per-instance listeners in the constructor; `attributeChangedCallback` guarded for pre-render calls.
- **Chart palette is FROZEN at the validated values** — `--chart-1: #3b82f6`, `--chart-2: #d97706`, `--chart-3: #0d9488`, `--chart-4: #c026d3`. Changing any value requires re-running the validator (Task 1 Step 3) and both modes passing.
- Dataviz method rules: categorical hues in fixed slot order (1→4), never cycled; >4 ring segments fold into "Other"; text wears text tokens, never series color; 2px surface gaps between adjacent bars and ring segments; rounded data-ends; hover tooltips on bar/ring marks (hit target ≥ mark); sr-only data summary in every chart; legend only for ≥2 segments; status tones never color-alone (glyph/label always present).
- 44px touch targets on interactive elements (datestrip days/arrows).
- No `view-transition-name` additions; only `src/` files below are touched; no worker/ changes; no push/deploy.
- Commit after every task with the message given in the task.

## File Structure

- `src/shared/styles/theme.css` — glass + chart tokens (Task 1)
- `src/shared/controls/ax-chip.js`, `ax-trend.js` (Task 2)
- `src/shared/controls/ax-stat.js` (Task 3)
- `src/shared/controls/ax-progress-ring.js` (Task 4)
- `src/shared/controls/ax-ring.js` (Task 5)
- `src/shared/controls/ax-barchart.js` (Task 6)
- `src/shared/controls/ax-datestrip.js` (Task 7)
- `src/features/dashboard/{data.json,dashboard.js,dashboard.css}` — flagship rebuild (Task 8)
- `src/features/components/{components.js,components.css}` — reference sections (Task 9)
- `MANIFEST.toml` (Task 10)

---

### Task 1: Glass surfaces + validated chart palette

**Files:**
- Modify: `src/shared/styles/theme.css` (token block additions in `:root` and `:root[data-theme="light"]`)

**Interfaces:**
- Produces (all later tasks consume): `--glass-panel`, `--glass-panel-border`, `--glass-tile`, `--glass-tile-border`, `--chart-1..4`, utility classes `.glass-panel`, `.glass-tile`.

- [ ] **Step 1: Add tokens.** In `:root`, after the `--control-track` line, add:

```css
  /* Glass surface system: panel = outer sheet, tile = nested inner card */
  --glass-panel: rgba(18, 18, 24, 0.55);
  --glass-panel-border: rgba(255, 255, 255, 0.12);
  --glass-tile: rgba(255, 255, 255, 0.06);
  --glass-tile-border: rgba(255, 255, 255, 0.08);

  /* Chart palette — VALIDATED 2026-07-18 with the dataviz six-check script
     against BOTH surfaces (dark #09090b, light #f1f5f9). All hard checks pass
     (worst adjacent ΔE 12.5 protan / 24.3 normal). Contrast: ≥ 3:1 in dark;
     light mode WARNs on --chart-2 (2.91:1) — legal per the method ONLY because
     every chart mark ships with text labels/legend/sr-only relief. Keep that
     invariant. Do NOT change a value without re-running the validator. */
  --chart-1: #3b82f6;
  --chart-2: #d97706;
  --chart-3: #0d9488;
  --chart-4: #c026d3;
```

In `:root[data-theme="light"]`, after its `--control-track` line, add:

```css
  --glass-panel: rgba(255, 255, 255, 0.55);
  --glass-panel-border: rgba(0, 0, 0, 0.08);
  --glass-tile: rgba(255, 255, 255, 0.55);
  --glass-tile-border: rgba(0, 0, 0, 0.06);
```

(Chart tokens are NOT overridden in light mode — the one set passes both surfaces.)

- [ ] **Step 2: Add utility classes** at the end of theme.css (before the reduced-motion block):

```css
/* ============ GLASS SURFACES ============ */
.glass-panel {
  background: var(--glass-panel);
  border: 1px solid var(--glass-panel-border);
  border-radius: 20px;
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  padding: var(--space-l);
}

.glass-tile {
  background: var(--glass-tile);
  border: 1px solid var(--glass-tile-border);
  border-radius: 14px;
  padding: var(--space-m);
}
```

- [ ] **Step 3: Palette gate.** Locate the dataviz skill's validator (this session:
`/private/tmp/claude-501/bundled-skills/2.1.211/b4fea42b39bee2169cdc8534fd521028/dataviz/scripts/validate_palette.js`; if absent, ask the controller — the skill ships it). Run BOTH:

```bash
node <validator> "#3b82f6,#d97706,#0d9488,#c026d3" --mode dark --surface "#09090b"
node <validator> "#3b82f6,#d97706,#0d9488,#c026d3" --mode light --surface "#f1f5f9"
```

Expected: `→ ALL CHECKS PASS` for both. Paste both outputs into your report.

- [ ] **Step 4: Verify brace balance + grep gates on theme.css.** Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/styles/theme.css
git commit -m "feat(glass): two-level glass surface tokens + validator-passed chart palette"
```

---

### Task 2: `ax-chip` + `ax-trend`

**Files:**
- Create: `src/shared/controls/ax-chip.js`
- Create: `src/shared/controls/ax-trend.js`

**Interfaces:**
- Produces: `<ax-chip tone="ongoing|complete|neutral">label</ax-chip>` — pill badge; `complete` renders a ✓ glyph before the slotted label; tone changes cross-fade.
- Produces: `<ax-trend value="-3.54" good></ax-trend>` — arrow + `±N.NN%`; `good` flips tone mapping (down = success). Property `value` get/set number.

- [ ] **Step 1: Create `src/shared/controls/ax-chip.js`**

```js
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
```

- [ ] **Step 2: Create `src/shared/controls/ax-trend.js`**

```js
/**
 * <ax-trend value="-3.54" good></ax-trend> — signed delta with arrow.
 * `good` = downward is desirable (weight loss). Sign + arrow carry the
 * meaning; color is reinforcement, never the only channel.
 */
import { BaseComponent } from '@shared/base-component.js';

const CSS = `
  :host { display: inline-flex; }
  .trend {
    display: inline-flex; align-items: center; gap: 0.25em;
    font-size: var(--text-xs); font-weight: 600;
    font-family: var(--font-mono);
    transition: color var(--duration-fast) var(--ease-out-soft);
  }
  .trend.up-good, .trend.down-good { color: var(--success-color); }
  .trend.up-bad, .trend.down-bad { color: var(--danger-color); }
  .trend.flat { color: var(--color-muted); }
`;

export class AxTrend extends BaseComponent {
  static observedAttributes = ['value', 'good'];

  constructor() {
    super();
    this.addStyles(CSS);
  }

  get value() { return Number(this.getAttribute('value')) || 0; }
  set value(v) { this.setAttribute('value', v); }

  attributeChangedCallback() {
    if (this._el) this._sync();
  }

  render() {
    this.shadowRoot.innerHTML = `<span class="trend" part="trend"></span>`;
    this._el = this.shadowRoot.querySelector('.trend');
    this._sync();
  }

  _sync() {
    const v = this.value;
    const goodDown = this.hasAttribute('good');
    const up = v > 0;
    const cls = v === 0 ? 'flat'
      : up ? (goodDown ? 'up-bad' : 'up-good')
      : (goodDown ? 'down-good' : 'down-bad');
    this._el.className = `trend ${cls}`;
    const arrow = v === 0 ? '' : up ? '▲ ' : '▼ ';
    const sign = up ? '+' : '';
    this._el.textContent = `${arrow}${sign}${v.toFixed(2)}%`;
    this._el.setAttribute('aria-label',
      v === 0 ? 'unchanged' : `${up ? 'up' : 'down'} ${Math.abs(v).toFixed(2)} percent`);
  }
}

customElements.define('ax-trend', AxTrend);
```

- [ ] **Step 3: Gates.** `node --check` both files; motion grep gates scoped to both (empty).

- [ ] **Step 4: Commit**

```bash
git add src/shared/controls/ax-chip.js src/shared/controls/ax-trend.js
git commit -m "feat(dataviz): ax-chip status pill + ax-trend delta indicator"
```

---

### Task 3: `ax-stat`

**Files:**
- Create: `src/shared/controls/ax-stat.js`

**Interfaces:**
- Produces: `<ax-stat value="108" unit="bpm" label="Heart Rate"><svg slot="icon">…</svg><ax-trend slot="trend" …></ax-trend></ax-stat>` — glass stat tile; value changes cross-fade. Property `value` get/set.

- [ ] **Step 1: Create `src/shared/controls/ax-stat.js`**

```js
/**
 * <ax-stat value="108" unit="bpm" label="Heart Rate"> — glass stat tile.
 * Slots: icon (left chip), trend (right of value). The dataviz "not a
 * chart" form: a headline number, no hover layer.
 */
import { BaseComponent } from '@shared/base-component.js';

const CSS = `
  :host { display: block; }
  .tile {
    display: flex; align-items: center; gap: var(--space-m);
    background: var(--glass-tile); border: 1px solid var(--glass-tile-border);
    border-radius: 14px; padding: var(--space-m);
  }
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
`;

export class AxStat extends BaseComponent {
  static observedAttributes = ['value', 'unit', 'label'];

  constructor() {
    super();
    this.addStyles(CSS);
  }

  get value() { return this.getAttribute('value') ?? ''; }
  set value(v) { this.setAttribute('value', v); }

  attributeChangedCallback(name) {
    if (!this._value) return;
    if (name === 'value') {
      // Cross-fade the number: fade out, swap text, fade back in.
      this._value.classList.add('swap');
      setTimeout(() => {
        this._value.textContent = this.value;
        this._value.classList.remove('swap');
      }, 200);
    } else {
      this._syncText();
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <div class="tile" part="tile">
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
```

- [ ] **Step 2: Gates.** `node --check`; motion greps scoped to the file. NOTE the `setTimeout(..., 200)` is a JS timing constant matched to `--duration-fast` — add the comment `// matches --duration-fast` on that line if not present (grep gates only scan transition/animation declarations, so a bare 200 in JS is legal, but the comment keeps intent clear).

- [ ] **Step 3: Commit**

```bash
git add src/shared/controls/ax-stat.js
git commit -m "feat(dataviz): ax-stat glass stat tile with icon/trend slots"
```

---

### Task 4: `ax-progress-ring`

**Files:**
- Create: `src/shared/controls/ax-progress-ring.js`

**Interfaces:**
- Produces: `<ax-progress-ring value="83" size="44" label="Steps">` — circular gauge; property `value` tweens the sweep (never jumps); at `value >= 100` draws a check; ARIA progressbar via ElementInternals (same contract as `ax-progress`: clamped 0–100, NaN → 0).

- [ ] **Step 1: Create `src/shared/controls/ax-progress-ring.js`**

```js
/**
 * <ax-progress-ring value="83" size="44"> — circular gauge on a
 * --control-track rail. Sweep tweens via stroke-dashoffset (never jumps).
 * At 100 the arc completes and a check mark draws in.
 */
import { BaseComponent } from '@shared/base-component.js';

const STROKE = 4;

const CSS = `
  :host { display: inline-flex; }
  svg { display: block; transform: rotate(-90deg); }
  .rail { stroke: var(--control-track); fill: none; }
  .arc {
    stroke: var(--color-primary); fill: none; stroke-linecap: round;
    transition: stroke-dashoffset var(--duration-slow) var(--ease-out-soft),
      stroke var(--duration-fast) var(--ease-out-soft);
  }
  :host([data-done]) .arc { stroke: var(--success-color); }
  .check {
    stroke: var(--success-color); fill: none; stroke-width: ${STROKE};
    stroke-linecap: round; stroke-linejoin: round;
    transform: rotate(90deg); transform-origin: center;
    stroke-dasharray: 30; stroke-dashoffset: 30;
    transition: stroke-dashoffset var(--duration-base) var(--ease-spring);
  }
  :host([data-done]) .check { stroke-dashoffset: 0; }
`;

export class AxProgressRing extends BaseComponent {
  static observedAttributes = ['value', 'label'];

  constructor() {
    super();
    this._internals = this.attachInternals();
    this._internals.role = 'progressbar';
    this.addStyles(CSS);
  }

  get value() { return this._value ?? 0; }
  set value(v) { this.setAttribute('value', v); }

  attributeChangedCallback() {
    if (this._arc) this._sync();
  }

  render() {
    const size = Number(this.getAttribute('size')) > 0 ? Number(this.getAttribute('size')) : 44;
    const r = (size - STROKE) / 2;
    const c = 2 * Math.PI * r;
    this._circumference = c;
    const mid = size / 2;
    this.shadowRoot.innerHTML = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle class="rail" cx="${mid}" cy="${mid}" r="${r}" stroke-width="${STROKE}"></circle>
        <circle class="arc" cx="${mid}" cy="${mid}" r="${r}" stroke-width="${STROKE}"
          stroke-dasharray="${c}" stroke-dashoffset="${c}"></circle>
        <path class="check" d="M ${mid - r * 0.42} ${mid} l ${r * 0.3} ${r * 0.3} l ${r * 0.55} ${-r * 0.6}"></path>
      </svg>`;
    this._arc = this.shadowRoot.querySelector('.arc');
    // Double rAF so the initial dashoffset commits before the sweep target,
    // otherwise the first paint jumps instead of animating.
    requestAnimationFrame(() => requestAnimationFrame(() => this._sync()));
  }

  _sync() {
    const raw = Number(this.getAttribute('value'));
    this._value = Number.isNaN(raw) ? 0 : Math.min(100, Math.max(0, raw));
    this._arc.style.strokeDashoffset = String(this._circumference * (1 - this._value / 100));
    this.toggleAttribute('data-done', this._value >= 100);
    this._internals.ariaLabel = this.getAttribute('label') || 'Progress';
    this._internals.ariaValueMin = '0';
    this._internals.ariaValueMax = '100';
    this._internals.ariaValueNow = String(this._value);
  }
}

customElements.define('ax-progress-ring', AxProgressRing);
```

- [ ] **Step 2: Gates.** `node --check`; motion greps scoped (empty).

- [ ] **Step 3: Commit**

```bash
git add src/shared/controls/ax-progress-ring.js
git commit -m "feat(dataviz): ax-progress-ring circular gauge with tweened sweep and completion check"
```

---

### Task 5: `ax-ring`

**Files:**
- Create: `src/shared/controls/ax-ring.js`

**Interfaces:**
- Produces: `<ax-ring size="160" label="Overview">` — property `segments` set `[{label, value}]` (get returns the normalized array actually rendered); default slot = center content; named slot `legend` replaces the built-in legend. Colors from `--chart-N` in fixed slot order; >4 segments folds tail into "Other" (uses `--chart-4`); <2 segments suppresses the legend box. Per-segment hover/focus tooltip; sr-only summary; `role="img"` + aria-label.

- [ ] **Step 1: Create `src/shared/controls/ax-ring.js`**

```js
/**
 * <ax-ring size="160"> — segmented glass donut. Segments render in fixed
 * --chart-N slot order (never cycled); >4 folds into "Other". 2px gaps,
 * rounded caps, sequential sweep-in. Center content is slotted.
 */
import { BaseComponent } from '@shared/base-component.js';

const STROKE = 12;
const GAP_PX = 2;
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

  get segments() { return this._segments; }
  set segments(arr) {
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
          role="img" aria-label="${this._esc(this.getAttribute('label') || 'Ring chart')}"></svg>
        <div class="center" part="center"><slot></slot></div>
        <div class="tip" aria-hidden="true"></div>
      </div>
      <slot name="legend"><div class="legend" part="legend"></div></slot>
      <span class="sr-only" data-summary></span>`;
    this._svg = this.shadowRoot.querySelector('svg');
    this._tip = this.shadowRoot.querySelector('.tip');
    this._draw();
  }

  _draw() {
    const size = this._size, r = (size - STROKE) / 2, mid = size / 2;
    const c = 2 * Math.PI * r;
    const segs = this._segments;
    const total = segs.reduce((a, s) => a + s.value, 0);
    const gaps = segs.length > 1 ? segs.length * GAP_PX : 0;
    const usable = c - gaps;

    let svg = `<circle class="rail" cx="${mid}" cy="${mid}" r="${r}" stroke-width="${STROKE}"></circle>`;
    let offset = 0;
    segs.forEach((s, i) => {
      const len = total > 0 ? (s.value / total) * usable : 0;
      svg += `<circle class="seg" data-i="${i}" tabindex="0" cx="${mid}" cy="${mid}" r="${r}"
        stroke-width="${STROKE}" stroke="var(--chart-${i + 1})"
        stroke-dasharray="0 ${c}" stroke-dashoffset="${-offset}"
        style="transition-delay: calc(var(--duration-fast) * ${i})"
        data-len="${len}" data-rest="${c - len}"
        aria-label="${this._esc(s.label)}: ${s.value}"></circle>`;
      offset += len + (segs.length > 1 ? GAP_PX : 0);
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
    if (!seg) { this._tip.classList.remove('show'); return; }
    const s = this._segments[Number(seg.dataset.i)];
    if (!s) return;
    this._tip.textContent = `${s.label}: ${s.value}`;
    this._tip.classList.add('show');
  }
}

customElements.define('ax-ring', AxRing);
```

- [ ] **Step 2: Gates.** `node --check`; motion greps scoped (empty — the delay uses `calc(var(--duration-fast) * i)`, token-derived).

- [ ] **Step 3: Commit**

```bash
git add src/shared/controls/ax-ring.js
git commit -m "feat(dataviz): ax-ring segmented glass donut with sweep-in, legend, tooltips"
```

---

### Task 6: `ax-barchart`

**Files:**
- Create: `src/shared/controls/ax-barchart.js`

**Interfaces:**
- Produces: `<ax-barchart unit="%" label="Weekly activity">` — property `data` set `[{label, value}]` (also `data` attribute accepting the same as JSON; property wins). Attr `max` (default data max). Rounded pill bars on rails, staggered spring grow-in, selective labels (value ≥ 60% of max, plus first and last), per-bar hover/focus tooltip, sr-only full list. Empty/invalid data → rails only.

- [ ] **Step 1: Create `src/shared/controls/ax-barchart.js`**

```js
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
  static observedAttributes = ['data', 'max', 'unit'];

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
    this._data = (Array.isArray(arr) ? arr : [])
      .filter(d => d && !Number.isNaN(Number(d.value)))
      .map(d => ({ label: String(d.label ?? ''), value: Number(d.value) }));
    if (this._chart) this._draw();
  }

  attributeChangedCallback(name) {
    if (!this._chart) return;
    if (name === 'data') this._parseAttr();
    else this._draw();
  }

  _parseAttr() {
    try { this.data = JSON.parse(this.getAttribute('data') || '[]'); }
    catch { this.data = []; }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <div class="chart" part="chart" role="img"
        aria-label="${this._esc(this.getAttribute('label') || 'Bar chart')}"></div>
      <span class="sr-only" data-summary></span>`;
    this._chart = this.shadowRoot.querySelector('.chart');
    if (!this._data.length && this.getAttribute('data')) this._parseAttr();
    else this._draw();
  }

  _draw() {
    const unit = this.getAttribute('unit') || '';
    const attrMax = Number(this.getAttribute('max'));
    const max = attrMax > 0 ? attrMax : Math.max(1, ...this._data.map(d => d.value));
    this._chart.innerHTML = this._data.map((d, i) => {
      const pct = Math.min(100, Math.max(0, (d.value / max) * 100));
      // Selective labels: >= 60% of max, plus first and last bar.
      const labeled = pct >= 60 || i === 0 || i === this._data.length - 1;
      return `
      <div class="col">
        <div class="rail" tabindex="0" data-i="${i}" role="presentation"
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
```

- [ ] **Step 2: Gates.** `node --check`; motion greps scoped (empty — stagger delays are `calc()` on tokens).

- [ ] **Step 3: Commit**

```bash
git add src/shared/controls/ax-barchart.js
git commit -m "feat(dataviz): ax-barchart pill bars with spring stagger, selective labels, tooltips"
```

---

### Task 7: `ax-datestrip`

**Files:**
- Create: `src/shared/controls/ax-datestrip.js`

**Interfaces:**
- Produces: `<ax-datestrip date="2026-07-13" selected="2026-07-18">` — week strip (Sunday-start) around `date`; selected pill glides between day columns; prev/next shift the week ±7 days; arrow keys move selection. Emits `change` (`bubbles, composed`, `detail: { date }` — ISO `YYYY-MM-DD`). Property `selected` get/set ISO string.

- [ ] **Step 1: Create `src/shared/controls/ax-datestrip.js`**

```js
/**
 * <ax-datestrip date="2026-07-13" selected="2026-07-18"> — week strip.
 * Selected-day pill glides between columns (dock-pill pattern). Emits
 * `change` with detail.date as ISO YYYY-MM-DD.
 */
import { BaseComponent } from '@shared/base-component.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CSS = `
  :host { display: block; }
  .strip { display: flex; align-items: center; gap: var(--space-2xs); position: relative; }
  .nav {
    all: unset; cursor: pointer; min-width: 44px; min-height: 44px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 50%; color: var(--color-muted);
    transition: color var(--duration-fast) var(--ease-out-soft),
      background var(--duration-fast) var(--ease-out-soft),
      transform var(--duration-fast) var(--ease-spring);
  }
  .nav:hover { color: var(--color-foreground); background: var(--glass-tile); }
  .nav:active { transform: scale(0.88); }
  .nav:focus-visible { outline: 2px solid var(--color-primary); }
  .days { flex: 1; display: flex; position: relative; }
  .day {
    all: unset; cursor: pointer; flex: 1; min-height: 48px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 2px; border-radius: 12px; position: relative; z-index: 1;
    -webkit-tap-highlight-color: transparent;
  }
  .day:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .dow { font-size: var(--text-xs); color: var(--color-muted); }
  .dom { font-size: var(--text-sm); font-weight: 700; color: var(--color-foreground); }
  .pill {
    position: absolute; left: 0; top: 0; z-index: 0;
    background: var(--glass-tile); border: 1px solid var(--glass-tile-border);
    border-radius: 12px; opacity: 0; pointer-events: none;
    transition: transform var(--duration-base) var(--ease-spring),
      width var(--duration-base) var(--ease-spring),
      opacity var(--duration-fast) var(--ease-out-soft);
  }
`;

// Local-date ISO — toISOString() would shift the day in UTC+ timezones.
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = s => {
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

export class AxDatestrip extends BaseComponent {
  static observedAttributes = ['date', 'selected'];

  constructor() {
    super();
    this.addStyles(CSS);
  }

  get selected() { return this.getAttribute('selected') || ''; }
  set selected(v) { this.setAttribute('selected', v); }

  attributeChangedCallback() {
    if (this._days) this._sync(false);
  }

  render() {
    this.shadowRoot.innerHTML = `
      <div class="strip" part="strip" role="group"
        aria-label="${this._esc(this.getAttribute('label') || 'Week')}">
        <button class="nav" data-shift="-7" aria-label="Previous week">&lsaquo;</button>
        <div class="days"><span class="pill" aria-hidden="true"></span></div>
        <button class="nav" data-shift="7" aria-label="Next week">&rsaquo;</button>
      </div>`;
    this._days = this.shadowRoot.querySelector('.days');
    this._pill = this.shadowRoot.querySelector('.pill');

    this.shadowRoot.addEventListener('click', e => {
      const nav = e.target.closest?.('.nav');
      if (nav) {
        const anchor = parse(this.getAttribute('date') || iso(new Date()));
        anchor.setDate(anchor.getDate() + Number(nav.dataset.shift));
        this.setAttribute('date', iso(anchor));
        return;
      }
      const day = e.target.closest?.('.day');
      if (day) this._select(day.dataset.date);
    });
    this.shadowRoot.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const d = parse(this.selected || this.getAttribute('date') || iso(new Date()));
      d.setDate(d.getDate() + (e.key === 'ArrowRight' ? 1 : -1));
      // Selection crossing the week boundary shifts the visible week too.
      this.setAttribute('date', iso(d));
      this._select(iso(d));
      e.preventDefault();
    });

    this._sync(true);
  }

  _select(dateStr) {
    if (!dateStr || dateStr === this.selected) return;
    this.selected = dateStr;
    this.dispatchEvent(new CustomEvent('change', {
      bubbles: true, composed: true, detail: { date: dateStr }
    }));
  }

  _sync(initial) {
    const anchor = parse(this.getAttribute('date') || iso(new Date()));
    anchor.setDate(anchor.getDate() - anchor.getDay()); // back to Sunday
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + i);
      days.push(d);
    }
    const sel = this.selected;
    this._days.querySelectorAll('.day').forEach(el => el.remove());
    days.forEach(d => {
      const s = iso(d);
      const btn = document.createElement('button');
      btn.className = 'day';
      btn.dataset.date = s;
      if (s === sel) btn.setAttribute('aria-current', 'date');
      btn.innerHTML = `<span class="dow">${DAYS[d.getDay()]}</span><span class="dom">${d.getDate()}</span>`;
      this._days.appendChild(btn);
    });
    this._positionPill(!initial);
  }

  _positionPill(animate) {
    const active = this.shadowRoot.querySelector('[aria-current="date"]');
    if (!active) { this._pill.style.opacity = '0'; return; }
    if (!animate) this._pill.style.transition = 'none';
    this._pill.style.opacity = '1';
    this._pill.style.width = `${active.offsetWidth}px`;
    this._pill.style.height = `${active.offsetHeight}px`;
    this._pill.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
    if (!animate) requestAnimationFrame(() => { this._pill.style.transition = ''; });
  }
}

customElements.define('ax-datestrip', AxDatestrip);
```

- [ ] **Step 2: Gates.** `node --check`; motion greps scoped (empty).

- [ ] **Step 3: Commit**

```bash
git add src/shared/controls/ax-datestrip.js
git commit -m "feat(dataviz): ax-datestrip week strip with gliding selection pill"
```

---

### Task 8: `/dashboard` flagship rebuild

**Files:**
- Modify: `src/features/dashboard/data.json` (replace content wholesale)
- Modify: `src/features/dashboard/dashboard.js` (keep class shell/loading/error branches; replace the success-render body and add control imports)
- Modify: `src/features/dashboard/dashboard.css` (replace layout styles below the header rules)

**Interfaces:**
- Consumes: every Task 2–7 component with the exact contracts above; existing route wiring (`api`/`dataKey: 'dashboardData'`) and the loading/error render branches stay untouched.
- Produces: the payload shape below (showcase/docs may reference it).\n- Note: the Output panel is a deliberate addition beyond spec §3's five panels — reference-image parity, and it exercises ax-trend `good` + the neutral chip.

- [ ] **Step 1: Replace `src/features/dashboard/data.json`**

```json
{
  "title": "Lifestats",
  "activity": {
    "unit": "%",
    "days": [
      { "label": "Sun", "value": 23 },
      { "label": "Tue", "value": 55 },
      { "label": "Wed", "value": 50 },
      { "label": "Thu", "value": 70 },
      { "label": "Fri", "value": 40 },
      { "label": "Sat", "value": 65 },
      { "label": "Mon", "value": 30 }
    ]
  },
  "overview": {
    "percent": 75,
    "centerLabel": "1034 ml",
    "segments": [
      { "label": "Calories Burn", "value": 37.5, "trend": 1.27 },
      { "label": "Protein", "value": 37.5, "trend": 3.54 },
      { "label": "Carbs", "value": 25, "trend": 1.34 }
    ]
  },
  "stats": [
    { "icon": "heart", "value": "108", "unit": "bpm", "label": "Heart Rate" },
    { "icon": "distance", "value": "2.5", "unit": "km", "label": "Distance" },
    { "icon": "water", "value": "1.7", "unit": "l", "label": "Water" }
  ],
  "challenges": [
    { "title": "15,000 steps in a day", "progress": 83, "fraction": "12,540/15,000", "state": "ongoing" },
    { "title": "3L Water Drink in a day", "progress": 100, "fraction": "3L/3L", "state": "complete" },
    { "title": "One hour exercise", "progress": 66, "fraction": "40Min/60Min", "state": "ongoing" }
  ],
  "week": { "anchor": "2026-07-13", "selected": "2026-07-18" },
  "output": { "value": "2.5", "unit": "Kg", "label": "Weight Loss", "trend": -2.5, "badge": "amazing!" }
}
```

- [ ] **Step 2: dashboard.js — add imports at top (below existing imports):**

```js
import '@shared/controls/ax-barchart.js';
import '@shared/controls/ax-ring.js';
import '@shared/controls/ax-progress-ring.js';
import '@shared/controls/ax-stat.js';
import '@shared/controls/ax-trend.js';
import '@shared/controls/ax-chip.js';
import '@shared/controls/ax-datestrip.js';
```

- [ ] **Step 3: dashboard.js — replace the success-branch markup and wire data.** Keep everything through the error branch. After `const payload = dashboardState.data || dashboardState;` replace the rest of `render()` with:

```js
    // Each icon carries slot="icon" so it is the TOP-LEVEL slotted element —
    // ax-stat's ::slotted(svg) sizing only matches top-level nodes.
    const icons = {
      heart: `<svg slot="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>`,
      distance: `<svg slot="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.5" r="2.5"></circle><path d="m10.2 9.4-3.7 4.1 3 2.2L8 21"></path><path d="m13.8 9.4 2.3 2.9 3.9 1.2"></path><path d="M10.2 9.4c.6-.7 1.5-1.1 2.4-.9l1.2.3"></path></svg>`,
      water: `<svg slot="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69 6.34 8.34a8 8 0 1 0 11.31 0z"></path></svg>`
    };
    const p = payload;
    const selDate = p.week?.selected ? new Date(`${p.week.selected}T00:00:00`) : null;
    const monthLabel = selDate && !Number.isNaN(selDate.getTime())
      ? selDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : 'This week';

    this.shadowRoot.innerHTML = `
      <div class="dashboard-container">
        <header class="dash-header"><h1>${this._esc(p.title || 'Dashboard')}</h1></header>
        <div class="glass-panel dash-grid">

          <section class="glass-tile panel-activity">
            <h2>Activity</h2>
            <ax-barchart unit="${this._esc(p.activity?.unit || '')}" label="Weekly activity"></ax-barchart>
          </section>

          <section class="stat-col">
            ${(p.stats || []).map(s => `
              <ax-stat value="${this._esc(s.value)}" unit="${this._esc(s.unit)}" label="${this._esc(s.label)}">
                ${icons[s.icon] || ''}
              </ax-stat>`).join('')}
          </section>

          <section class="glass-tile panel-overview">
            <h2>Overview</h2>
            <div class="overview-body">
              <ax-ring size="160" label="Daily overview">
                <span class="ring-pct">${Number(p.overview?.percent) || 0}%</span>
                <span class="ring-sub">${this._esc(p.overview?.centerLabel || '')}</span>
                <div slot="legend" class="overview-legend">
                  ${(p.overview?.segments || []).map((s, i) => `
                    <div class="legend-line">
                      <span class="dot" style="background: var(--chart-${i + 1})"></span>
                      <span class="legend-label">${this._esc(s.label)}</span>
                      <strong>${s.value}</strong>
                      <ax-trend value="${Number(s.trend) || 0}"></ax-trend>
                    </div>`).join('')}
                </div>
              </ax-ring>
            </div>
          </section>

          <section class="glass-tile panel-challenges">
            <h2>Challenges</h2>
            ${(p.challenges || []).map(c => `
              <div class="challenge-row">
                <ax-progress-ring value="${Number(c.progress) || 0}" size="40" label="${this._esc(c.title)}"></ax-progress-ring>
                <span class="challenge-title">${this._esc(c.title)}</span>
                <span class="challenge-fraction">${this._esc(c.fraction)}</span>
                <ax-chip tone="${c.state === 'complete' ? 'complete' : 'ongoing'}">${c.state === 'complete' ? 'Complete' : 'On Going'}</ax-chip>
              </div>`).join('')}
          </section>

          <section class="glass-tile panel-week">
            <h2>${this._esc(monthLabel)}</h2>
            <ax-datestrip date="${this._esc(p.week?.anchor || '')}" selected="${this._esc(p.week?.selected || '')}"></ax-datestrip>
          </section>

          <section class="glass-tile panel-output">
            <h2>Output</h2>
            <div class="output-row">
              <ax-stat value="${this._esc(p.output?.value || '')}" unit="${this._esc(p.output?.unit || '')}" label="${this._esc(p.output?.label || '')}">
                <ax-trend slot="trend" value="${Number(p.output?.trend) || 0}" good></ax-trend>
              </ax-stat>
              <ax-chip tone="neutral">${this._esc(p.output?.badge || '')}</ax-chip>
            </div>
          </section>

        </div>
      </div>`;

    // Charts take structured data via properties (attributes can't carry arrays cleanly).
    this.shadowRoot.querySelector('ax-barchart').data = p.activity?.days || [];
    this.shadowRoot.querySelector('ax-ring').segments = p.overview?.segments || [];
```

- [ ] **Step 4: dashboard.css — keep `:host`, `.dashboard-container`, `.dash-header`, `.subtitle`, spinner/center/error rules; replace everything below them with:**

```css
.dash-grid {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr 1fr;
  gap: var(--space-m);
}

.dash-grid h2 {
  font-size: var(--text-base);
  font-weight: 700;
  margin-bottom: var(--space-s);
}

.stat-col { display: flex; flex-direction: column; gap: var(--space-s); }

.panel-challenges { grid-column: 1 / span 2; }

.challenge-row {
  display: flex; align-items: center; gap: var(--space-m);
  padding: var(--space-s) 0;
  border-bottom: 1px solid var(--glass-tile-border);
}
.challenge-row:last-child { border-bottom: none; }
.challenge-title { flex: 1; font-weight: 600; }
.challenge-fraction { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--color-muted); }

.overview-body { display: flex; justify-content: center; }
.overview-legend { display: flex; flex-direction: column; gap: var(--space-xs); width: 100%; }
.legend-line {
  display: flex; align-items: center; gap: var(--space-xs);
  font-size: var(--text-sm); color: var(--color-muted);
}
.legend-line strong { color: var(--color-foreground); }
.legend-line .dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 8px; }
.ring-pct { font-size: var(--text-2xl); font-weight: 800; color: var(--color-foreground); }
.ring-sub { font-size: var(--text-xs); color: var(--color-muted); }

.output-row { display: flex; align-items: center; gap: var(--space-m); }
.output-row ax-stat { flex: 1; }

@media (max-width: 900px) {
  .dash-grid { grid-template-columns: 1fr; }
  .panel-challenges { grid-column: auto; }
}
```

- [ ] **Step 5: Gates.** `node --check src/features/dashboard/dashboard.js`; motion greps scoped to dashboard files (empty); `python3 -c "import json; json.load(open('src/features/dashboard/data.json'))"` (valid JSON).

- [ ] **Step 6: Commit**

```bash
git add src/features/dashboard
git commit -m "feat(dashboard): rebuild as flagship glass Lifestats composition"
```

---

### Task 9: `/components` reference sections

**Files:**
- Modify: `src/features/components/components.js` (imports + sections + wiring)
- Modify: `src/features/components/components.css` (small additions)

**Interfaces:**
- Consumes: all Task 2–7 components with the contracts above; existing `_wire()`/`$` helper pattern and `disconnectedCallback` in the file.

- [ ] **Step 1: Add imports** below the existing control imports in components.js:

```js
import '@shared/controls/ax-barchart.js';
import '@shared/controls/ax-ring.js';
import '@shared/controls/ax-progress-ring.js';
import '@shared/controls/ax-stat.js';
import '@shared/controls/ax-trend.js';
import '@shared/controls/ax-chip.js';
import '@shared/controls/ax-datestrip.js';
```

- [ ] **Step 2: Add sections** to the template, after the Popover section and before Motion tokens:

```html
        <section class="glass-card">
          <h2>Bar chart</h2>
          <ax-barchart class="demo-bars" unit="%" label="Demo bars"></ax-barchart>
          <ax-button variant="ghost" class="bars-randomize">Randomize</ax-button>
        </section>

        <section class="glass-card">
          <h2>Ring &amp; progress rings</h2>
          <div class="row">
            <ax-ring class="demo-ring" size="150" label="Demo ring">
              <span class="ring-pct">75%</span>
            </ax-ring>
            <div class="ring-gauges">
              <ax-progress-ring class="demo-pring" value="40" size="56" label="Demo gauge"></ax-progress-ring>
              <ax-slider class="pring-slider" label="Drive the gauge" value="40"></ax-slider>
            </div>
          </div>
        </section>

        <section class="glass-card">
          <h2>Stat, trend &amp; chip</h2>
          <div class="row">
            <ax-stat value="108" unit="bpm" label="Heart Rate">
              <span slot="icon">&hearts;</span>
              <ax-trend slot="trend" value="1.27"></ax-trend>
            </ax-stat>
            <ax-chip class="demo-chip" tone="ongoing">On Going</ax-chip>
            <ax-button variant="ghost" class="chip-toggle">Toggle tone</ax-button>
          </div>
        </section>

        <section class="glass-card">
          <h2>Date strip</h2>
          <ax-datestrip class="demo-strip"></ax-datestrip>
          <p class="strip-log token-note">Select a day&hellip;</p>
        </section>
```

- [ ] **Step 3: Wire in `_wire()`** (before the replayTokens block):

```js
    const seedBars = () => {
      $('.demo-bars').data = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        .map(label => ({ label, value: Math.round(Math.random() * 90) + 10 }));
    };
    $('.bars-randomize').addEventListener('click', seedBars);
    seedBars();

    $('.demo-ring').segments = [
      { label: 'Calories', value: 37.5 },
      { label: 'Protein', value: 37.5 },
      { label: 'Carbs', value: 25 }
    ];

    $('.pring-slider').addEventListener('input', e => {
      $('.demo-pring').value = e.detail.value;
    });

    $('.chip-toggle').addEventListener('click', () => {
      const chip = $('.demo-chip');
      const done = chip.getAttribute('tone') === 'complete';
      chip.setAttribute('tone', done ? 'ongoing' : 'complete');
      chip.textContent = done ? 'On Going' : 'Complete';
    });

    $('.demo-strip').addEventListener('change', e => {
      $('.strip-log').textContent = `change → ${e.detail.date}`;
    });
```

- [ ] **Step 4: components.css additions:**

```css
.ring-gauges { display: flex; flex-direction: column; align-items: center; gap: var(--space-s); min-width: 200px; }
.ring-pct { font-size: var(--text-xl); font-weight: 800; color: var(--color-foreground); }
.demo-bars { margin-bottom: var(--space-m); }
```

- [ ] **Step 5: Gates.** `node --check src/features/components/components.js`; motion greps scoped (empty).

- [ ] **Step 6: Commit**

```bash
git add src/features/components
git commit -m "feat(showcase): reference sections for the glass data-viz set"
```

---

### Task 10: Final verification + MANIFEST

**Files:**
- Modify: `MANIFEST.toml`

- [ ] **Step 1: Full grep gates** (both commands, repo-wide). Expected: empty.

- [ ] **Step 2: Build + tests:** `node tools/minify.js` from project root (guards pass), `npm run test:tools` (13/13).

- [ ] **Step 3: Controller browser walkthrough** (controller-driven, not this task's implementer): dashboard light+dark (bar stagger, ring sweep, tooltips mouse+keyboard, datestrip glide + change events, chips/trends), showcase sections live, reduced-motion collapse, anti-patterns checklist pass.

- [ ] **Step 4: MANIFEST.toml** — append after the motion-system capability, and bump `[project] updated`:

```toml
[[capabilities]]
id = "glass-dataviz-set"
tags = ["es6", "web-components", "a11y", "dataviz"]
claim = "Glassmorphism data-viz primitives (ax-barchart, ax-ring, ax-progress-ring, ax-stat, ax-trend, ax-chip, ax-datestrip) + two-level glass surface tokens + six-check-validated chart palette (--chart-1..4, passes CVD/contrast on both themes); flagship /dashboard composition. Requires motion-system-control-set tokens; sync src/shared/ wholesale."
maturity = "shipped"
entry_points = ["src/shared/controls/", "src/shared/styles/theme.css", "src/features/dashboard/dashboard.js", "docs/superpowers/specs/2026-07-18-glass-dataviz-design.md"]
pattern_doc = ""
```

- [ ] **Step 5: Commit**

```bash
git add MANIFEST.toml
git commit -m "chore: record glass-dataviz-set capability; verification pass complete"
```

(Do NOT push or deploy — dual-remote policy; that's the user's call.)
