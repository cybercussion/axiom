# Cyber-Neumorphism Surface Tier — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A second surface tier (`neu`) beside glass — depth/gradient-face tokens, four hardware primitives (ax-gauge, ax-stepper, ax-led, ax-knob), `surface="neu"` variants incl. realistic slide/rocker switches, a power-panel showcase, and the agent-facing CONTROLS.md.

**Architecture:** Everything is additive: tokens + utilities in theme.css, pure-CSS `:host([surface="neu"])` variant blocks appended to existing controls (no JS/contract changes except dipswitch forwarding one attribute), and four new single-file BaseComponent controls following the established house pattern. Spec: `docs/superpowers/specs/2026-07-20-cyber-neumorphism-design.md`.

**Tech Stack:** Vanilla ES modules, Web Components, CSS (`color-mix`, `perspective`, constructed-sheet memoized `addStyles`). Zero dependencies.

**Testing model:** node --check + motion gate (`npm run lint:motion` — now executable) per task; controller-driven browser verification at milestones (after Tasks 6 and 7); build+tests at the end.

## Global Constraints

- Vanilla ES6 + home-grown CSS only; no libraries, no build steps, no new base classes; variants are additive CSS on existing controls.
- Motion tokens only; sanctioned infinite loops tagged `/* motion-gate: allow */`; the executable gate (`npm run build` runs it) must stay clean.
- JS timers that wait out CSS transitions use `motionMs()` (`@shared/motion.js`). **Interaction cadences (stepper hold-repeat) use plain constants (400ms initial, 120ms repeat) and deliberately do NOT collapse under reduced motion.**
- `--accent-glow` is decorative only — shadows/glows, never text ink, never a data-mark color. `--chart-*` untouched (no validator run needed; assert in review).
- House control contract: BaseComponent subclass, memoized `addStyles`, dumb (attrs/props in, `bubbles: true, composed: true` events with `detail` out), `_esc()` on interpolated text, once-per-instance listeners in constructor, guarded `attributeChangedCallback`, ElementInternals ARIA, 44px targets, property-wins where a data attr exists.
- Numeric attrs clamped/NaN-guarded. Same-value changes are no-ops (no events, no flicker).
- Commit per task with the given message. No push/deploy.

## File Structure

- `src/shared/styles/theme.css` — neu token block + `.neu-panel/.neu-well/.neu-glow` utilities (Task 1)
- `src/shared/controls/ax-led.js`, `ax-stepper.js` (Task 2)
- `src/shared/controls/ax-gauge.js` (Task 3)
- `src/shared/controls/ax-knob.js` (Task 4)
- `src/shared/controls/{ax-button,ax-slider,ax-progress}.js` — CSS variant blocks (Task 5)
- `src/shared/controls/{ax-toggle,ax-dipswitch}.js` — realistic switches (Task 6)
- `src/features/components/{components.js,components.css}` — power panel + knob demo (Task 7)
- `docs/CONTROLS.md` (Task 8)
- `MANIFEST.toml` (Task 9)

---

### Task 1: Neu depth tokens + surface utilities

**Files:**
- Modify: `src/shared/styles/theme.css`

**Interfaces:**
- Produces (all later tasks consume): `--neu-surface`, `--neu-surface-deep`, `--neu-light`, `--neu-dark`, `--accent-glow`, `--neu-face`, `--neu-face-pressed`, `--neu-raised`, `--neu-raised-sm`, `--neu-well`, `--neu-glow`; utilities `.neu-panel`, `.neu-well`, `.neu-glow`.

- [ ] **Step 1: Add the neu token block** in `:root`, immediately after the `--control-track` line:

```css
  /* ============ NEU SURFACE TIER ============
     glass = translucency + blur; neu = opacity + depth. Dual-shadow
     extrusion + gradient faces (reference technique: raised elements wear a
     top-lit vertical gradient, pressed swaps to inset + darkened face).
     --accent-glow is DECORATIVE ONLY: shadows and glows, never text ink,
     never a data-mark color. */
  --neu-surface: #1c1e26;
  --neu-surface-deep: #14161c;
  --neu-light: rgba(255, 255, 255, 0.06);
  --neu-dark: rgba(0, 0, 0, 0.62);
  --accent-glow: #38bdf8;
  --neu-face: linear-gradient(180deg,
      color-mix(in srgb, var(--neu-surface) 88%, white) 0%, var(--neu-surface) 100%);
  --neu-face-pressed: linear-gradient(180deg,
      color-mix(in srgb, var(--neu-surface) 90%, black) 0%, var(--neu-surface) 100%);
  --neu-raised: -6px -6px 14px var(--neu-light), 6px 6px 16px var(--neu-dark);
  --neu-raised-sm: -3px -3px 7px var(--neu-light), 3px 3px 8px var(--neu-dark);
  --neu-well: inset 4px 4px 10px var(--neu-dark), inset -4px -4px 8px var(--neu-light);
  --neu-glow: 0 0 24px color-mix(in srgb, var(--accent-glow) 40%, transparent);
```

- [ ] **Step 2: Light-theme overrides** in `:root[data-theme="light"]`, after its `--control-track` line (only the material pieces — recipes inherit):

```css
  --neu-surface: #e6e9f0;
  --neu-surface-deep: #d9dde6;
  --neu-light: rgba(255, 255, 255, 0.92);
  --neu-dark: rgba(163, 177, 198, 0.55);
```

- [ ] **Step 3: Utilities**, appended next to the glass utilities block:

```css
/* ============ NEU SURFACES ============ */
.neu-panel {
  background: var(--neu-face);
  border-radius: 24px;
  box-shadow: var(--neu-raised);
  padding: var(--space-l);
}

.neu-well {
  background: var(--neu-surface-deep);
  border-radius: 16px;
  box-shadow: var(--neu-well);
  padding: var(--space-m);
}

.neu-glow { box-shadow: var(--neu-raised), var(--neu-glow); }
```

- [ ] **Step 4: Gates.** Brace balance; `npm run lint:motion` clean; verify `--chart-` grep shows no changes (`git diff src/shared/styles/theme.css | grep chart` → empty).

- [ ] **Step 5: Commit**

```bash
git add src/shared/styles/theme.css
git commit -m "feat(neu): depth tokens, gradient faces, and surface utilities for the neu tier"
```

---

### Task 2: `ax-led` + `ax-stepper`

**Files:**
- Create: `src/shared/controls/ax-led.js`
- Create: `src/shared/controls/ax-stepper.js`

**Interfaces:**
- Produces: `<ax-led tone="ok|info|warn|danger|off" pulse label="...">` — status dot; no label → `aria-hidden`; with label → `role="status"` + aria-label.
- Produces: `<ax-stepper value min max step label orientation="vertical|horizontal">` — property `value` (number get/set); emits `change` (`detail: { value }`) once per activation/repeat tick; keyboard Up/Down (Left/Right horizontal); clamps; exhausted key gets `aria-disabled` + dimmed.

- [ ] **Step 1: Create `src/shared/controls/ax-led.js`**

```js
/**
 * <ax-led tone="ok|info|warn|danger|off" pulse label="Link up"> — status dot.
 * Never color-alone: a labeled LED announces via role=status; an unlabeled
 * one is decoration and is aria-hidden.
 */
import { BaseComponent } from '@shared/base-component.js';

const TONES = ['ok', 'info', 'warn', 'danger', 'off'];

const CSS = `
  :host { display: inline-flex; }
  .led {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--color-muted); opacity: 0.35;
    transition: background var(--duration-fast) var(--ease-out-soft),
      box-shadow var(--duration-fast) var(--ease-out-soft),
      opacity var(--duration-fast) var(--ease-out-soft);
  }
  .led.ok { background: var(--success-color); opacity: 1; box-shadow: 0 0 8px var(--success-color); }
  .led.info { background: var(--accent-glow); opacity: 1; box-shadow: 0 0 8px var(--accent-glow); }
  .led.warn { background: var(--warning-color); opacity: 1; box-shadow: 0 0 8px var(--warning-color); }
  .led.danger { background: var(--danger-color); opacity: 1; box-shadow: 0 0 8px var(--danger-color); }
  :host([pulse]) .led:not(.off) {
    animation: ax-led-pulse 2s var(--ease-cinematic) infinite; /* motion-gate: allow */
  }
  @keyframes ax-led-pulse { 50% { opacity: 0.45; } }
  /* Pulse carries no state — kill it for reduced-motion users (the
     [data-motion] preview can't pierce shadow CSS; OS setting governs). */
  @media (prefers-reduced-motion: reduce) {
    :host([pulse]) .led { animation: none; }
  }
`;

export class AxLed extends BaseComponent {
  static observedAttributes = ['tone', 'label'];

  constructor() {
    super();
    this._internals = this.attachInternals();
    this.addStyles(CSS);
  }

  attributeChangedCallback() {
    if (this._led) this._sync();
  }

  render() {
    this.shadowRoot.innerHTML = `<span class="led" part="led"></span>`;
    this._led = this.shadowRoot.querySelector('.led');
    this._sync();
  }

  _sync() {
    const tone = TONES.includes(this.getAttribute('tone')) ? this.getAttribute('tone') : 'off';
    this._led.className = `led ${tone}`;
    const label = this.getAttribute('label');
    if (label) {
      this._internals.role = 'status';
      this._internals.ariaLabel = `${label}: ${tone}`;
      this.removeAttribute('aria-hidden');
    } else {
      this._internals.role = 'presentation';
      this.setAttribute('aria-hidden', 'true');
    }
  }
}

customElements.define('ax-led', AxLed);
```

- [ ] **Step 2: Create `src/shared/controls/ax-stepper.js`**

```js
/**
 * <ax-stepper value="20" min="0" max="100" step="5" label="Capacity"> —
 * chevron up/down keys on a raised neu pill. Hold-to-repeat uses PLAIN
 * interaction constants (NOT motionMs): repeat cadence is input rate, not a
 * transition wait, and must not collapse under reduced motion.
 */
import { BaseComponent } from '@shared/base-component.js';

const HOLD_DELAY_MS = 400;
const HOLD_REPEAT_MS = 120;

const CSS = `
  :host { display: inline-flex; }
  .pill {
    display: flex; flex-direction: column; border-radius: 999px;
    background: var(--neu-face); box-shadow: var(--neu-raised-sm);
    overflow: hidden;
  }
  :host([orientation="horizontal"]) .pill { flex-direction: row-reverse; }
  .key {
    all: unset; cursor: pointer; min-width: 44px; min-height: 44px;
    display: flex; align-items: center; justify-content: center;
    color: var(--color-foreground);
    transition: background var(--duration-fast) var(--ease-out-soft),
      opacity var(--duration-fast) var(--ease-out-soft);
    -webkit-tap-highlight-color: transparent;
  }
  .key:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
  .key:active { background: var(--neu-face-pressed); box-shadow: var(--neu-well); }
  .key[aria-disabled="true"] { opacity: 0.35; cursor: default; }
  .key svg { width: 16px; height: 16px; }
`;

export class AxStepper extends BaseComponent {
  static formAssociated = true;
  static observedAttributes = ['value', 'min', 'max', 'step', 'label'];

  constructor() {
    super();
    this._internals = this.attachInternals();
    this._internals.role = 'spinbutton';
    this.addStyles(CSS);
    this._stopHold = () => { clearTimeout(this._holdTimer); clearInterval(this._holdRepeat); };
  }

  get value() { return this._value ?? 0; }
  set value(v) { this.setAttribute('value', v); }

  attributeChangedCallback() {
    if (this._pill) this._sync();
  }

  render() {
    const chevron = dir => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="${dir > 0 ? '6 15 12 9 18 15' : '6 9 12 15 18 9'}"></polyline></svg>`;
    this.shadowRoot.innerHTML = `
      <div class="pill" part="pill">
        <button class="key" data-dir="1" aria-label="Increase">${chevron(1)}</button>
        <button class="key" data-dir="-1" aria-label="Decrease">${chevron(-1)}</button>
      </div>`;
    this._pill = this.shadowRoot.querySelector('.pill');

    this._pill.addEventListener('pointerdown', e => {
      const key = e.target.closest('.key');
      if (!key || key.getAttribute('aria-disabled') === 'true') return;
      const dir = Number(key.dataset.dir);
      this._bump(dir);
      this._holdTimer = setTimeout(() => {
        this._holdRepeat = setInterval(() => this._bump(dir), HOLD_REPEAT_MS);
      }, HOLD_DELAY_MS);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t =>
      this._pill.addEventListener(t, this._stopHold));

    this._pill.addEventListener('keydown', e => {
      const horizontal = this.getAttribute('orientation') === 'horizontal';
      const up = horizontal ? 'ArrowRight' : 'ArrowUp';
      const down = horizontal ? 'ArrowLeft' : 'ArrowDown';
      if (e.key === up) { this._bump(1); e.preventDefault(); }
      if (e.key === down) { this._bump(-1); e.preventDefault(); }
    });

    this._sync();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopHold();
  }

  _bounds() {
    const min = Number(this.getAttribute('min')); const max = Number(this.getAttribute('max'));
    return {
      min: Number.isFinite(min) ? min : 0,
      max: Number.isFinite(max) ? max : 100,
      step: Number(this.getAttribute('step')) > 0 ? Number(this.getAttribute('step')) : 1
    };
  }

  _bump(dir) {
    const { min, max, step } = this._bounds();
    const next = Math.min(max, Math.max(min, this.value + dir * step));
    if (next === this.value) { this._stopHold(); return; }
    this.setAttribute('value', String(next));
    this.dispatchEvent(new CustomEvent('change', {
      bubbles: true, composed: true, detail: { value: next }
    }));
  }

  _sync() {
    const { min, max } = this._bounds();
    const raw = Number(this.getAttribute('value'));
    this._value = Number.isNaN(raw) ? min : Math.min(max, Math.max(min, raw));
    this._internals.ariaLabel = this.getAttribute('label') || 'Stepper';
    this._internals.ariaValueMin = String(min);
    this._internals.ariaValueMax = String(max);
    this._internals.ariaValueNow = String(this._value);
    const [inc, dec] = this._pill.querySelectorAll('.key');
    inc.setAttribute('aria-disabled', String(this._value >= max));
    dec.setAttribute('aria-disabled', String(this._value <= min));
  }
}

customElements.define('ax-stepper', AxStepper);
```

- [ ] **Step 3: Gates.** `node --check` both; `npm run lint:motion` clean (the LED pulse line is tagged).

- [ ] **Step 4: Commit**

```bash
git add src/shared/controls/ax-led.js src/shared/controls/ax-stepper.js
git commit -m "feat(neu): ax-led status dot + ax-stepper chevron spinbutton with hold-to-repeat"
```

---

### Task 3: `ax-gauge`

**Files:**
- Create: `src/shared/controls/ax-gauge.js`

**Interfaces:**
- Produces: `<ax-gauge value="29" max="100" unit="%" label="Battery power" ticks="6" height="240">` — vertical inset meter; property `value` tweens; ABSENT value → 0 + `data-empty` attr (no indeterminate state); ElementInternals `role="meter"`; sr-only summary.

- [ ] **Step 1: Create `src/shared/controls/ax-gauge.js`**

```js
/**
 * <ax-gauge value="29" unit="%" label="Battery power"> — vertical neu meter:
 * tick ruler at left, deep inset well, glowing aurora fill. Height-based
 * fill (never scale — scaling squashes rounded caps).
 */
import { BaseComponent } from '@shared/base-component.js';

const CSS = `
  :host { display: inline-flex; }
  .gauge { display: flex; gap: var(--space-s); align-items: stretch; }
  .ruler {
    display: flex; flex-direction: column; justify-content: space-between;
    font-family: var(--font-mono); font-size: var(--text-xs);
    color: var(--color-muted); text-align: right; user-select: none;
  }
  .ruler span::after { content: ' –'; }
  .well {
    position: relative; width: 56px; border-radius: 999px;
    background: var(--neu-surface-deep); box-shadow: var(--neu-well);
    overflow: hidden;
  }
  .fill {
    position: absolute; left: 4px; right: 4px; bottom: 4px; height: 0;
    border-radius: 999px;
    background: linear-gradient(180deg,
      color-mix(in srgb, var(--accent-glow) 70%, var(--color-primary)) 0%,
      var(--color-primary) 100%);
    box-shadow: 0 0 18px color-mix(in srgb, var(--accent-glow) 45%, transparent);
    transition: height var(--duration-slow) var(--ease-out-soft);
  }
  :host([data-empty]) .fill { box-shadow: none; }
`;

export class AxGauge extends BaseComponent {
  static observedAttributes = ['value', 'max', 'unit', 'label'];

  constructor() {
    super();
    this._internals = this.attachInternals();
    this._internals.role = 'meter';
    this.addStyles(CSS);
  }

  get value() { return this._value ?? 0; }
  set value(v) { this.setAttribute('value', v); }

  attributeChangedCallback() {
    if (this._fill) this._sync();
  }

  render() {
    const height = Number(this.getAttribute('height')) > 0 ? Number(this.getAttribute('height')) : 240;
    const ticks = Number(this.getAttribute('ticks')) > 1 ? Number(this.getAttribute('ticks')) : 6;
    const max = this._max();
    const labels = Array.from({ length: ticks }, (_, i) =>
      Math.round(max - i * (max / (ticks - 1))));
    this.shadowRoot.innerHTML = `
      <div class="gauge" part="gauge" style="height: ${height}px">
        <div class="ruler" part="ruler" aria-hidden="true">
          ${labels.map(l => `<span>${l}</span>`).join('')}
        </div>
        <div class="well" part="well"><div class="fill" part="fill"></div></div>
      </div>
      <span class="sr-only" data-summary></span>`;
    this._fill = this.shadowRoot.querySelector('.fill');
    // Double rAF so the initial 0-height commits and the first value tweens in.
    requestAnimationFrame(() => requestAnimationFrame(() => this._sync()));
  }

  _max() {
    const m = Number(this.getAttribute('max'));
    return Number.isFinite(m) && m > 0 ? m : 100;
  }

  _sync() {
    const max = this._max();
    const attr = this.getAttribute('value');
    const raw = attr === null ? NaN : Number(attr);
    const empty = Number.isNaN(raw);
    this.toggleAttribute('data-empty', empty);
    this._value = empty ? 0 : Math.min(max, Math.max(0, raw));
    this._fill.style.height = `calc(${(this._value / max) * 100}% - 8px)`;
    const unit = this.getAttribute('unit') || '';
    this._internals.ariaLabel = this.getAttribute('label') || 'Gauge';
    this._internals.ariaValueMin = '0';
    this._internals.ariaValueMax = String(max);
    this._internals.ariaValueNow = String(this._value);
    this.shadowRoot.querySelector('[data-summary]').textContent =
      empty ? 'no reading' : `${this._value}${unit} of ${max}${unit}`;
  }
}

customElements.define('ax-gauge', AxGauge);
```

- [ ] **Step 2: Gates.** `node --check`; `npm run lint:motion` clean.

- [ ] **Step 3: Commit**

```bash
git add src/shared/controls/ax-gauge.js
git commit -m "feat(neu): ax-gauge vertical tick-ruler meter with glowing aurora fill"
```

---

### Task 4: `ax-knob`

**Files:**
- Create: `src/shared/controls/ax-knob.js`

**Interfaces:**
- Produces: `<ax-knob value="30" min="0" max="100" step="1" size="96" label="Volume">` — rotary dial; property `value` (number); emits `input` during drag, `change` on release ONLY if the value differed from drag start; vertical drag (pointer capture, up = increase), keyboard Arrow/Home/End, Escape cancels an active drag restoring the pre-drag value; ARIA `role="slider"`; formAssociated.

- [ ] **Step 1: Create `src/shared/controls/ax-knob.js`**

```js
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
  static observedAttributes = ['value', 'min', 'max', 'label'];

  constructor() {
    super();
    this._internals = this.attachInternals();
    this._internals.role = 'slider';
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
      <div class="knob" part="knob" tabindex="0" style="width:${size}px;height:${size}px;--dot-r:${mid - 22}px">
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
        Math.round((this._dragStart.value + dv) / step) * step));
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
    const min = Number(this.getAttribute('min')); const max = Number(this.getAttribute('max'));
    const b = {
      min: Number.isFinite(min) ? min : 0,
      max: Number.isFinite(max) ? max : 100
    };
    const step = Number(this.getAttribute('step'));
    b.step = Number.isFinite(step) && step > 0 ? step : 1;
    return b;
  }

  _sync() {
    const { min, max } = this._bounds();
    const raw = Number(this.getAttribute('value'));
    this._value = Number.isNaN(raw) ? min : Math.min(max, Math.max(min, raw));
    const frac = max > min ? (this._value - min) / (max - min) : 0;
    this._arc.setAttribute('stroke-dasharray',
      `${this._circumference * SWEEP * frac} ${this._circumference}`);
    this._dot.style.setProperty('--ang', `${-135 + frac * 270}deg`);
    this._internals.ariaLabel = this.getAttribute('label') || 'Knob';
    this._internals.ariaValueMin = String(min);
    this._internals.ariaValueMax = String(max);
    this._internals.ariaValueNow = String(this._value);
    this._internals.setFormValue(String(this._value));
  }
}

customElements.define('ax-knob', AxKnob);
```

- [ ] **Step 2: Gates.** `node --check`; `npm run lint:motion` clean.

- [ ] **Step 3: Commit**

```bash
git add src/shared/controls/ax-knob.js
git commit -m "feat(neu): ax-knob rotary dial — 270° glow arc, vertical drag, full slider ARIA"
```

---

### Task 5: `surface="neu"` variants — button, slider, progress

**Files:**
- Modify: `src/shared/controls/ax-button.js` (CSS append)
- Modify: `src/shared/controls/ax-slider.js` (CSS append)
- Modify: `src/shared/controls/ax-progress.js` (CSS append)

**Interfaces:**
- Consumes: Task 1 tokens. NO JS changes in any file — append to each `CSS` constant just before its closing backtick. `surface` is a construction-time attribute (not observed — the documented boundary, same as `size`).

- [ ] **Step 1: ax-button.js — append:**

```css
  /* ===== surface="neu" — raised hardware key (ON-key feel) ===== */
  :host([surface="neu"]) .btn {
    background: var(--neu-face);
    color: var(--color-foreground);
    text-shadow: none;
    box-shadow: var(--neu-raised-sm);
  }
  :host([surface="neu"]) .btn:hover { transform: none; filter: none; box-shadow: var(--neu-raised); }
  :host([surface="neu"]) .btn:active {
    transform: none;
    background: var(--neu-face-pressed);
    box-shadow: var(--neu-well);
  }
  :host([surface="neu"][tone="danger"]) .btn { color: var(--danger-color); }
  :host([surface="neu"][tone="success"]) .btn { color: var(--success-color); }
  :host([surface="neu"][shape="round"]) .btn {
    border-radius: 50%; padding: 0; width: 56px; height: 56px; min-height: 56px;
  }
```

- [ ] **Step 2: ax-slider.js — append:**

```css
  /* ===== surface="neu" — inset groove + aurora fill (composes with variant="fill") ===== */
  :host([surface="neu"]) input::-webkit-slider-runnable-track {
    box-shadow: var(--neu-well);
    background: linear-gradient(to right,
      color-mix(in srgb, var(--color-primary) 55%, var(--accent-glow)) var(--fill, 0%),
      var(--neu-surface-deep) var(--fill, 0%));
  }
  :host([surface="neu"]) input::-moz-range-track {
    box-shadow: var(--neu-well); background: var(--neu-surface-deep);
  }
  :host([surface="neu"]) input::-moz-range-progress {
    background: color-mix(in srgb, var(--color-primary) 55%, var(--accent-glow));
  }
  :host([surface="neu"]) input::-webkit-slider-thumb {
    background: var(--neu-face); box-shadow: var(--neu-raised-sm);
  }
  :host([surface="neu"]) input::-moz-range-thumb {
    background: var(--neu-face); box-shadow: var(--neu-raised-sm);
  }
```

- [ ] **Step 3: ax-progress.js — append:**

```css
  /* ===== surface="neu" — inset groove + glowing fill sliver ===== */
  :host([surface="neu"]) .track {
    background: var(--neu-surface-deep); box-shadow: var(--neu-well);
  }
  :host([surface="neu"]) .fill {
    background: linear-gradient(90deg, var(--color-primary),
      color-mix(in srgb, var(--accent-glow) 70%, var(--color-primary)));
    box-shadow: 0 0 10px color-mix(in srgb, var(--accent-glow) 45%, transparent);
  }
```

- [ ] **Step 4: Gates.** `node --check` all three; `npm run lint:motion` clean; confirm zero JS-line changes (`git diff -U0 src/shared/controls/ax-button.js | grep -v "^[+-].*--neu\|^[+-].*surface\|^@@\|^+++\|^---"` — review the diff is CSS-only).

- [ ] **Step 5: Commit**

```bash
git add src/shared/controls/ax-button.js src/shared/controls/ax-slider.js src/shared/controls/ax-progress.js
git commit -m "feat(neu): surface=neu variants for button (hardware key), slider (groove+aurora), progress"
```

---

### Task 6: Realistic switches — `ax-toggle` slide + `ax-dipswitch` rocker

**Files:**
- Modify: `src/shared/controls/ax-toggle.js` (CSS append only)
- Modify: `src/shared/controls/ax-dipswitch.js` (CSS append + ONE-LINE render change forwarding `surface`)

**Interfaces:**
- Consumes: Task 1 tokens; ax-toggle's existing parts (`button`, `track`, `thumb`) and reflected `checked`.
- Produces: `<ax-toggle surface="neu">` slide switch; `<ax-dipswitch surface="neu">` rocker bank (forwards `surface` to its internal toggles).

- [ ] **Step 1: ax-toggle.js — append:**

```css
  /* ===== surface="neu" — realistic slide switch: deep groove, domed puck ===== */
  :host([surface="neu"]) button { min-width: 72px; min-height: 48px; }
  :host([surface="neu"]) .track {
    width: 56px; height: 28px; border-radius: 999px;
    background: var(--neu-surface-deep);
    box-shadow: var(--neu-well);
    transition: box-shadow var(--duration-fast) var(--ease-out-soft);
  }
  :host([surface="neu"][checked]) .track {
    box-shadow: var(--neu-well), inset 0 0 12px color-mix(in srgb, var(--accent-glow) 35%, transparent);
  }
  :host([surface="neu"]) .thumb {
    width: 22px; height: 22px;
    left: calc(50% - 28px + 3px); top: calc(50% - 11px);
    background:
      radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.28), transparent 60%),
      var(--neu-face);
    box-shadow: var(--neu-raised-sm);
  }
  :host([surface="neu"][checked]) .thumb {
    transform: translateX(28px);
    box-shadow: var(--neu-raised-sm), var(--neu-glow);
  }
  :host([surface="neu"]) button:active .thumb {
    transform: scale(0.94);
    box-shadow: var(--neu-raised-sm);
  }
  :host([surface="neu"][checked]) button:active .thumb {
    transform: translateX(28px) scale(0.94);
  }
```

- [ ] **Step 2: ax-dipswitch.js — forward `surface` in render().** Change the toggle line inside the labels map from:

```js
            <ax-toggle data-label="${this._esc(l)}" label="${this._esc(l)}" ${on.has(l) ? 'checked' : ''}></ax-toggle>
```

to:

```js
            <ax-toggle data-label="${this._esc(l)}" label="${this._esc(l)}" ${on.has(l) ? 'checked' : ''}${this.getAttribute('surface') === 'neu' ? ' surface="neu"' : ''}></ax-toggle>
```

- [ ] **Step 3: ax-dipswitch.js — append rocker CSS** (styles internal toggles via `::part` from the dipswitch's own shadow sheet):

```css
  /* ===== surface="neu" — rocker bank: caps TILT on a pivot instead of sliding ===== */
  :host([surface="neu"]) .bank {
    background: var(--neu-surface-deep); border: none;
    box-shadow: var(--neu-well); border-radius: 12px;
    padding: var(--space-s) var(--space-m);
  }
  /* Rockers do not slide — drop the -90° slide rotation, tilt instead. */
  :host([surface="neu"]) .dip ax-toggle { rotate: none; margin: 0; }
  /* The slide-switch variant sizes its key 72px wide — rockers are compact;
     override the part so the bank doesn't balloon. */
  :host([surface="neu"]) .dip ax-toggle::part(button) {
    min-width: 44px; min-height: 48px; perspective: 70px;
  }
  :host([surface="neu"]) .dip ax-toggle::part(track) {
    width: 26px; height: 40px; border-radius: 6px;
    background: var(--neu-face);
    box-shadow: var(--neu-raised-sm),
      inset 0 -10px 8px -8px var(--neu-dark),
      inset 0 10px 8px -8px var(--neu-light);
    transform: rotateX(-14deg);
    transition: transform var(--duration-base) var(--ease-spring),
      box-shadow var(--duration-fast) var(--ease-out-soft);
  }
  :host([surface="neu"]) .dip ax-toggle[checked]::part(track) {
    transform: rotateX(14deg);
    box-shadow: var(--neu-raised-sm),
      inset 0 10px 8px -8px var(--neu-dark),
      inset 0 -10px 8px -8px var(--neu-light);
  }
  /* Thumb becomes the ON indicator dot at the cap's top edge. */
  :host([surface="neu"]) .dip ax-toggle::part(thumb) {
    width: 6px; height: 6px; left: calc(50% - 3px); top: 8px;
    background: var(--color-muted); box-shadow: none; opacity: 0.4;
    transition: background var(--duration-fast) var(--ease-out-soft),
      opacity var(--duration-fast) var(--ease-out-soft),
      box-shadow var(--duration-fast) var(--ease-out-soft);
  }
  :host([surface="neu"]) .dip ax-toggle[checked]::part(thumb) {
    transform: none;
    background: var(--accent-glow); opacity: 1;
    box-shadow: 0 0 6px var(--accent-glow);
  }
```

- [ ] **Step 4: Gates.** `node --check` both; `npm run lint:motion` clean; confirm the ONLY JS change is the one-line surface forwarding (diff review).

- [ ] **Step 5: Commit**

```bash
git add src/shared/controls/ax-toggle.js src/shared/controls/ax-dipswitch.js
git commit -m "feat(neu): realistic switches — slide-puck toggle and tilting rocker dipswitch bank"
```

---

### Task 7: Power-panel showcase + knob demo

**Files:**
- Modify: `src/features/components/components.js` (imports + section + wiring)
- Modify: `src/features/components/components.css` (panel layout)

**Interfaces:**
- Consumes: everything from Tasks 1–6 with the exact contracts above.

- [ ] **Step 1: components.js — add imports** below the existing control imports:

```js
import '@shared/controls/ax-gauge.js';
import '@shared/controls/ax-stepper.js';
import '@shared/controls/ax-led.js';
import '@shared/controls/ax-knob.js';
```

- [ ] **Step 2: components.js — add the section** after the Date strip section, before Motion tokens:

```html
        <section class="glass-card">
          <h2>Cyber-Neumorphism</h2>
          <p class="token-note">Second surface tier: opacity + depth. Same tokens, same contracts.</p>
          <div class="neu-stage">
            <div class="neu-panel power-panel">
              <span class="power-label" aria-hidden="true">POWER</span>
              <ax-gauge class="power-gauge" value="29" unit="%" label="Battery power" height="220"></ax-gauge>
              <div class="power-mid">
                <span class="power-title">BATTERY POWER</span>
                <span class="power-readout"><strong class="power-num">29</strong> %</span>
                <ax-stepper class="power-stepper" value="29" min="0" max="100" step="1" label="Capacity"></ax-stepper>
                <span class="power-cap" aria-hidden="true">CAPACITY</span>
              </div>
              <div class="power-side">
                <div class="led-rail">
                  <ax-led tone="ok" label="Power"></ax-led>
                  <ax-led class="charge-led" tone="info" pulse label="Charging"></ax-led>
                  <ax-led tone="off" label="Fault"></ax-led>
                </div>
                <ax-button surface="neu" shape="round" class="power-on" aria-pressed="true">ON</ax-button>
              </div>
            </div>
            <div class="neu-panel knob-panel">
              <ax-knob class="demo-knob" value="30" label="Volume"></ax-knob>
              <span class="knob-readout token-note">Volume: <strong class="knob-num">30</strong></span>
              <ax-toggle surface="neu" checked label="Neu slide switch"></ax-toggle>
              <ax-dipswitch surface="neu" switches="PWR,NET,DBG" on="PWR" label="Neu rockers"></ax-dipswitch>
              <ax-slider surface="neu" variant="fill" label="Neu groove" value="55"></ax-slider>
              <ax-progress surface="neu" value="72" label="Neu progress"></ax-progress>
            </div>
          </div>
        </section>
```

- [ ] **Step 3: components.js — wiring in `_wire()`** (before replayTokens):

```js
    $('.power-stepper').addEventListener('change', e => {
      $('.power-gauge').value = e.detail.value;
      $('.power-num').textContent = e.detail.value;
      $('.charge-led').setAttribute('tone', e.detail.value >= 100 ? 'ok' : 'info');
    });

    $('.demo-knob').addEventListener('input', e => {
      $('.knob-num').textContent = e.detail.value;
    });
    $('.demo-knob').addEventListener('change', e => {
      $('.knob-num').textContent = e.detail.value;
    });
```

- [ ] **Step 4: components.css — append:**

```css
.neu-stage {
  display: flex; flex-wrap: wrap; gap: var(--space-l);
  padding: var(--space-l); border-radius: 20px;
  background: var(--neu-surface-deep);
}
.power-panel {
  display: flex; gap: var(--space-l); align-items: stretch;
}
.power-label {
  writing-mode: vertical-rl; transform: rotate(180deg);
  font-family: var(--font-mono); font-weight: 800; font-size: var(--text-2xl);
  letter-spacing: 0.35em; color: var(--color-muted); opacity: 0.5;
  align-self: center;
}
.power-mid { display: flex; flex-direction: column; align-items: center; gap: var(--space-s); justify-content: center; }
.power-title { font-family: var(--font-mono); font-size: var(--text-xs); letter-spacing: 0.25em; color: var(--color-muted); }
.power-readout { font-family: var(--font-mono); color: var(--color-muted); }
.power-num { font-size: var(--text-4xl); font-weight: 300; letter-spacing: 0.08em; color: var(--color-foreground); } /* light display numerals — Cybertruck reference */
.power-cap { font-family: var(--font-mono); font-size: var(--text-xs); letter-spacing: 0.25em; color: var(--color-muted); }
.power-side { display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: var(--space-m); }
.led-rail { display: flex; flex-direction: column; gap: var(--space-s); align-items: center; padding-top: var(--space-s); }
.knob-panel { display: flex; flex-direction: column; align-items: center; gap: var(--space-m); min-width: 220px; }
@media (max-width: 700px) {
  .power-panel { flex-direction: column; align-items: center; }
  .power-label { writing-mode: horizontal-tb; transform: none; align-self: center; }
}
```

- [ ] **Step 5: Gates.** `node --check components.js`; `npm run lint:motion` clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/components
git commit -m "feat(showcase): Cyber-Neumorphism power panel + knob/switch demo"
```

---

### Task 8: `docs/CONTROLS.md` — agent-facing contract reference

**Files:**
- Create: `docs/CONTROLS.md`

- [ ] **Step 1: Write the file.** One page, one table row per control, EXACT current contracts (verify each against source while writing — the source is the truth, this doc is its mirror). Structure:

```markdown
# Axiom Controls — Agent Reference

Every `ax-*` control follows ONE contract shape: **attributes/properties in,
composed `CustomEvent`s with `detail` out**. Skins via `surface="neu"` and
`variant` attributes. Structured data goes in via JS PROPERTY (primary) or
JSON attribute (markup); an explicitly set property permanently wins.
Surface/size/variant attrs are construction-time (set before insert).
Import: `import '@shared/controls/<tag>.js'` — importing defines the element.

| Tag | Attributes | Properties | Events (detail) | Slots | Variants |
|-----|-----------|------------|-----------------|-------|----------|
| ax-toggle | checked, disabled, label, name, value | checked | change ({checked}) | — | surface="neu" (slide switch) |
| ax-dipswitch | switches="A,B", on="A", label, surface | value → {label:bool}; setAll(map,{stagger}) | change ({label, checked, value}) | — | surface="neu" (rocker bank, forwards to toggles) |
| ax-slider | min, max, step, value, label, name, disabled, variant, surface | value (number) | input/change ({value}) | icon (variant="fill") | variant="fill", surface="neu" |
| ax-progress | value, max, indeterminate, label, surface | value | — | — | surface="neu"; absent value → indeterminate |
| ax-button | variant(fill\|outline\|ghost), tone, type(button\|submit), loading, disabled, surface, shape | — | click (native) | default label | surface="neu", shape="round" |
| ax-popover | open (reflected), aria-label | show(invoker)/hide()/toggle(invoker) | popover-open/close | default, legend n/a | — |
| ax-skeleton | done | — | — | — | — |
| ax-barchart | data (JSON), max, unit, label | data = [{label,value}] | — (tooltips internal) | — | — |
| ax-ring | segments (JSON), size, label | segments = [{label,value}] | — | default (center), legend | — |
| ax-progress-ring | value, size, label | value | — | — | — |
| ax-stat | value, unit, label | value | — | icon, trend | — |
| ax-trend | value (signed), good | value | — | — | — |
| ax-chip | tone (ongoing\|complete\|neutral) | — | — | default label | — |
| ax-datestrip | date (ISO), selected (ISO), label | selected | change ({date}) | — | — |
| ax-gauge | value, max, unit, label, ticks, height | value | — | — | absent value → data-empty |
| ax-stepper | value, min, max, step, label, orientation | value | change ({value}) | — | — |
| ax-led | tone (ok\|info\|warn\|danger\|off), pulse, label | — | — | — | no label → decorative (aria-hidden) |
| ax-knob | value, min, max, step, size, label | value | input/change ({value}) | — | — |

## Surfaces & utilities
- Glass: `.glass-panel` (outer sheet), `.glass-tile` (nested).
- Neu: `.neu-panel` (raised, gradient face), `.neu-well` (inset), `.neu-glow` (aurora).
- Motion: consume `var(--duration-*)`/`var(--ease-*)` only; JS waits via
  `motionMs()` from `@shared/motion.js`. `npm run lint:motion` enforces.
- Chart colors: `--chart-1..4` only, fixed slot order (validator-frozen — see
  theme.css comment before changing).
```

Verify every row against the actual source before committing (attrs/events may have drifted — source wins; fix the doc, not the code).

- [ ] **Step 2: Commit**

```bash
git add docs/CONTROLS.md
git commit -m "docs: CONTROLS.md — agent-facing contract reference for all ax-* controls"
```

---

### Task 9: Final verification + MANIFEST

**Files:**
- Modify: `MANIFEST.toml`

- [ ] **Step 1:** Full gates: `npm run build` (motion gate + minify guards), `npm run test:tools` (13/13). `git diff origin/main -- src/shared/styles/theme.css | grep "chart-"` → empty (palette untouched, no validator run needed).

- [ ] **Step 2:** Controller browser walkthrough (controller-driven): power panel both themes (light neumorphism must read), stepper hold-to-repeat + bounds, gauge tween, knob drag/keyboard/Escape-cancel, LED pulse + OS reduced-motion kill, slide switch + rocker bank, all neu variants beside glass ones.

- [ ] **Step 3:** MANIFEST — append after glass-dataviz-set, bump `[project] updated = "2026-07-20"`:

```toml
[[capabilities]]
id = "neu-surface-tier"
tags = ["es6", "web-components", "a11y", "design-system"]
claim = "Cyber-Neumorphism surface tier: depth/gradient-face tokens (--neu-*, --accent-glow decorative-only), .neu-panel/.neu-well utilities, surface=neu variants (button/slider/progress + realistic slide-switch toggle and tilting rocker dipswitch), four hardware primitives (ax-gauge, ax-stepper, ax-led, ax-knob), power-panel showcase; agent contract reference docs/CONTROLS.md. Depends on motion-system tokens + motionMs; sync src/shared/ wholesale."
maturity = "shipped"
entry_points = ["src/shared/styles/theme.css", "src/shared/controls/", "docs/CONTROLS.md", "docs/superpowers/specs/2026-07-20-cyber-neumorphism-design.md"]
pattern_doc = ""
```

- [ ] **Step 4: Commit**

```bash
git add MANIFEST.toml
git commit -m "chore: record neu-surface-tier capability; verification pass complete"
```

(No push/deploy — user's call.)
