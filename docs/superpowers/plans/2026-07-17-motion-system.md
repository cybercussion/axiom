# Axiom Motion System + Shared Control Set — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fleet-wide motion token system (CSS `linear()` springs) + seven `ax-*` shared Web Components, dock retrofit, and a `/components` showcase route in base Axiom.

**Architecture:** All motion physics live as CSS custom properties in `theme.css` (which `BaseComponent` adopts into every shadow root, and which `index.html` links at document level — so tokens inherit everywhere). Controls are single-file `formAssociated` Web Components in `src/shared/controls/`, styled via inline `addStyles()` CSS consuming only tokens. Reduced motion = one token override block (all durations → 1ms), so it collapses ALL motion at once.

**Tech Stack:** Vanilla ES modules, Web Components (Shadow DOM, ElementInternals), CSS `linear()` easing, `@starting-style` + `transition-behavior: allow-discrete`. Zero dependencies. Spec: `docs/superpowers/specs/2026-07-17-motion-system-design.md`.

**Testing model:** This zero-build stack has no browser test runner (`npm run test:tools` covers build tooling only). Each task's test cycle = dev-server browser verification (`npm run dev`, browser-sync on http://localhost:3000) plus two machine gates: the grep gate (no easing/duration literals outside the token block) and `node tools/minify.js` (run from project root, NEVER from `worker/`). Verify in Chrome via the claude-in-chrome tools when executing.

## Global Constraints

- **No literal `cubic-bezier()` anywhere in `src/` outside the theme.css token block.** Keyword easings (`ease`, `ease-out`) also migrate to tokens.
- **No literal `ms`/`s` durations in `transition:`/`animation:` declarations** — use `var(--duration-*)`. Two documented exceptions ONLY: infinite ambient loops (spinner/shimmer/spectrum keyframe loops) and route-progress's intentional 10s crawl. Each exception gets a `/* motion-gate: allow */` comment on its line.
- **No `display: none` hard cuts on anything user-toggled** — use `@starting-style` + `transition-behavior: allow-discrete`.
- Controls are dumb: value in (attributes/properties), events out (`bubbles: true, composed: true`). They never import `@state`.
- 44px minimum touch targets; no hover-only affordances; full keyboard + ARIA.
- Escape interpolated text with `this._esc()`.
- Zero new dependencies. No changes to `worker/`.
- Commit after every task with the message given in that task.

---

### Task 1: Motion token layer

**Files:**
- Modify: `src/shared/styles/theme.css` (token block at `:root`, ~line 58 where `--ease-elastic` lives)
- Modify: `src/shared/styles/animations.css` (full rewrite of the token consumption; keyframes unchanged)

**Interfaces:**
- Produces (all later tasks consume these exact names): `--duration-instant|fast|base|slow`, `--ease-spring`, `--ease-spring-gentle`, `--ease-out-soft`, `--ease-cinematic`.
- Produces: reduced-motion collapse via `@media (prefers-reduced-motion: reduce)` AND the manual override hook `:root[data-motion="reduced"]` (Task 10's showcase toggle sets that attribute).

- [ ] **Step 1: Replace the `/* Animation */` block in theme.css**

Find (theme.css ~line 58):

```css
  /* Animation */
  --ease-elastic: cubic-bezier(0.68, -0.55, 0.27, 1.55);
```

Replace with:

```css
  /* ============ MOTION TOKENS ============
     The ONLY place literal easings/durations may appear.
     Rule: every transition/animation in src/ consumes these vars.
     Exceptions (infinite ambient loops, route-progress 10s crawl)
     are marked "motion-gate: allow" at their use site. */

  --duration-instant: 100ms;
  --duration-fast: 200ms;
  --duration-base: 300ms;
  --duration-slow: 500ms;

  /* snappy, ~8% overshoot — toggles, buttons, dock pill */
  --ease-spring: linear(0, 0.006, 0.025 2.8%, 0.101 6.1%, 0.539 18.9%, 0.721 25.3%,
      0.849 31.5%, 0.937 38.1%, 0.968 41.8%, 0.991 45.7%, 1.006 50.1%, 1.015 55%,
      1.017 63.9%, 1.001);
  /* softer settle, minimal overshoot — menus, popovers */
  --ease-spring-gentle: linear(0, 0.013, 0.054 3.9%, 0.219 8.7%, 0.42 13.3%, 0.596 17.9%,
      0.744 22.6%, 0.863 27.8%, 0.945 33.4%, 0.997 40%, 1.021 48.3%, 1.016 61.4%, 1.003);
  /* decelerating glide — hovers, color/opacity changes */
  --ease-out-soft: cubic-bezier(0.16, 1, 0.3, 1);
  /* route transitions / large surface moves */
  --ease-cinematic: cubic-bezier(0.4, 0, 0.2, 1);
```

**Fallback cascade (spec §5):** the two spring token declarations above must be wrapped so browsers without `linear()` get a soft ease instead. Declare the fallbacks in `:root` FIRST, then override inside a support query (place this immediately after the token block):

```css
  /* In the :root token block, declare springs as fallbacks first: */
  --ease-spring: var(--ease-out-soft);
  --ease-spring-gentle: var(--ease-out-soft);
```

```css
/* After the :root block — real springs where linear() is supported */
@supports (transition-timing-function: linear(0, 1)) {
  :root {
    --ease-spring: linear(0, 0.006, 0.025 2.8%, 0.101 6.1%, 0.539 18.9%, 0.721 25.3%,
        0.849 31.5%, 0.937 38.1%, 0.968 41.8%, 0.991 45.7%, 1.006 50.1%, 1.015 55%,
        1.017 63.9%, 1.001);
    --ease-spring-gentle: linear(0, 0.013, 0.054 3.9%, 0.219 8.7%, 0.42 13.3%, 0.596 17.9%,
        0.744 22.6%, 0.863 27.8%, 0.945 33.4%, 0.997 40%, 1.021 48.3%, 1.016 61.4%, 1.003);
  }
}
```

- [ ] **Step 2: Add the global reduced-motion collapse at the END of theme.css**

```css
/* ============ REDUCED MOTION ============
   Because ALL motion consumes the tokens above, collapsing the tokens
   collapses every spring/slide in the app to a near-instant change.
   [data-motion="reduced"] is the showcase page's preview hook. */
@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-instant: 1ms;
    --duration-fast: 1ms;
    --duration-base: 1ms;
    --duration-slow: 1ms;
    --ease-spring: linear;
    --ease-spring-gentle: linear;
  }
}

:root[data-motion="reduced"] {
  --duration-instant: 1ms;
  --duration-fast: 1ms;
  --duration-base: 1ms;
  --duration-slow: 1ms;
  --ease-spring: linear;
  --ease-spring-gentle: linear;
}
```

- [ ] **Step 3: Retokenize animations.css**

At the top, replace:

```css
:root {
  --transition-easing: cubic-bezier(0.4, 0.0, 0.2, 1);
  --transition-duration: 300ms;
}
```

with:

```css
:root {
  /* Route-transition aliases — consume the shared motion tokens */
  --transition-easing: var(--ease-cinematic);
  --transition-duration: var(--duration-base);
}
```

Then in the same file replace the two fade literals (`animation: fade-out 250ms ease both;` / `animation: fade-in 250ms ease both;`) with `var(--duration-fast) var(--ease-out-soft)`, and in the `prefers-reduced-motion` block replace both `200ms ease` literals with `var(--duration-fast) var(--ease-out-soft)`. No keyframe changes.

- [ ] **Step 4: Verify in browser**

Run: `npm run dev` (leave running for all tasks). Navigate home → dashboard → back. Route transitions must look identical to before (same 300ms cinematic slide). In DevTools console: `getComputedStyle(document.documentElement).getPropertyValue('--ease-spring')` → returns the `linear(...)` string.

- [ ] **Step 5: Verify grep gate scoped to these two files**

Run: `grep -n "cubic-bezier\|[0-9]ms\|0\.[0-9]s" src/shared/styles/animations.css | grep -v "var(--"`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/shared/styles/theme.css src/shared/styles/animations.css
git commit -m "feat(motion): motion token layer with linear() springs + global reduced-motion collapse"
```

---

### Task 2: Retokenize sweep — kill every ad-hoc literal

**Files:**
- Modify: `src/shared/styles/theme.css` (body ~line 199, `.btn` ~line 356, `.btn-outline::before` ~line 399, spin usage ~line 410, `.glass-card` ~line 466, inputs ~line 514)
- Modify: `src/shared/styles/forms.css` (lines 38, 68, 120, 149, 188)
- Modify: `src/shared/styles/toast.css` (lines 35, 36, 82)
- Modify: `src/features/dashboard/dashboard.css` (lines 155, 168, 205, 235)
- Modify: `src/features/navigation/navigation.css` (line 17 `.nav-link`, lines 141–158 settings menu, lines 199, 214 toggle)
- Modify: `src/shared/route-progress.js` (lines 21, 36, 38, 80, 85, 95)
- Modify: `src/shared/modal.js` (lines 60, 84, 121, ~266)

**Interfaces:**
- Consumes: Task 1 tokens.
- Produces: a literal-free `src/` tree (the grep gate below is what Task 11 re-runs).

- [ ] **Step 1: Apply the mapping table**

| Old literal | Replacement |
|---|---|
| `0.2s ease` / `0.2s` / `all 0.2s ease` | `var(--duration-fast) var(--ease-out-soft)` (keep the property list, never `all` — name the properties actually transitioning, e.g. `color`, `background`, `transform`) |
| `0.3s ease` / `0.3s` | `var(--duration-base) var(--ease-out-soft)` |
| `0.3s cubic-bezier(0.16, 1, 0.3, 1)` | `var(--duration-base) var(--ease-out-soft)` |
| `0.3s cubic-bezier(0.34, 1.56, 0.64, 1)` (body padding, modal transform) | `var(--duration-base) var(--ease-spring)` |
| `0.3s cubic-bezier(0.4, 0.0, 0.2, 1)` (dashboard) | `var(--duration-base) var(--ease-cinematic)` |
| `0.3s cubic-bezier(0.2, 0.8, 0.2, 1)` (toast slideIn) | `var(--duration-base) var(--ease-spring-gentle)` |
| `0.3s cubic-bezier(0.4, 0, 1, 1)` (toast fadeOut) | `var(--duration-base) var(--ease-cinematic)` |
| `0.4s` (btn-outline::before opacity) | `var(--duration-base)` |
| `0.5s cubic-bezier(0.16, 1, 0.3, 1)` (glass-card) | `var(--duration-slow) var(--ease-out-soft)` |
| `0.2s ease-out` (settingsSlideUp, route-progress bar) | `var(--duration-fast) var(--ease-out-soft)` |
| `0.4s cubic-bezier(0.23, 1, 0.32, 1)` (route-progress) | `var(--duration-base) var(--ease-out-soft)` |
| `0.3s ease-out` (route-progress finish) | `var(--duration-base) var(--ease-out-soft)` |
| `spin 3s linear infinite`, `spinner 0.8s linear infinite`, `spectrum 1.5s linear infinite` | keep, append ` /* motion-gate: allow */` comment on the line |
| `transform 10s cubic-bezier(0, 0.5, 0.5, 1)` (route-progress crawl) | keep, append ` // motion-gate: allow` |

In `route-progress.js` and `modal.js` the styles are JS template strings — same replacements apply (`var(--duration-base)` works inside the injected `<style>`/adopted CSS because tokens inherit from `:root`).

In `modal.js` ~line 266 the JS timeout that waits for the close animation is a magic `300`. Replace with a named constant at the top of the file:

```js
// Must match --duration-base in theme.css (motion token layer)
const MODAL_ANIM_MS = 300;
```

and use `MODAL_ANIM_MS` at the call site.

- [ ] **Step 2: Run the full grep gate**

```bash
grep -rn "cubic-bezier" src --include="*.css" --include="*.js" | grep -v "shared/styles/theme.css" | grep -v "motion-gate: allow"
grep -rnE "(transition|animation)[^;{]*[0-9]+(\.[0-9]+)?m?s" src --include="*.css" --include="*.js" | grep -v "var(--duration" | grep -v "motion-gate: allow"
```

Expected: BOTH commands print nothing. If a line appears, retokenize it (or, only for an infinite ambient loop, tag it).

- [ ] **Step 3: Verify in browser**

Hard-reload http://localhost:3000. Check: button hovers on home, glass-card hover on dashboard, toast (trigger via contact form if wired) or skip, theme toggle in dock settings (light/dark cross-fade still smooth), modal open/close if reachable. Everything should feel the same or slightly snappier — no dead (instant) transitions.

- [ ] **Step 4: Commit**

```bash
git add -A src
git commit -m "refactor(motion): retokenize all transitions onto motion tokens; grep gate clean"
```

---

### Task 3: `_esc()` helper + `ax-toggle`

**Files:**
- Modify: `src/shared/base-component.js` (add `_esc` method)
- Create: `src/shared/controls/ax-toggle.js`

**Interfaces:**
- Produces: `BaseComponent.prototype._esc(str)` → HTML-escaped string (all controls + features may use it).
- Produces: `<ax-toggle>` — attrs `checked` (boolean, reflected), `disabled`, `label`, `name`, `value` (default `"on"`); property `checked` (get/set boolean); emits `change` (`bubbles, composed`, `detail: { checked }`); formAssociated (submits `value` when checked, nothing when not).

- [ ] **Step 1: Add `_esc` to BaseComponent** (below the `bridgeID` method):

```js
  /**
   * Escape text for interpolation into innerHTML templates.
   */
  _esc(str) {
    return String(str ?? '').replace(/[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
```

- [ ] **Step 2: Create `src/shared/controls/ax-toggle.js`**

```js
/**
 * <ax-toggle> — springy switch. Dumb control: attributes in, `change` event out.
 * formAssociated: submits `value` (default "on") when checked.
 */
import { BaseComponent } from '@shared/base-component.js';

const CSS = `
  :host { display: inline-flex; }
  :host([disabled]) { opacity: 0.5; pointer-events: none; }
  button {
    all: unset; position: relative; display: inline-flex;
    align-items: center; justify-content: center;
    min-width: 44px; min-height: 44px; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: 12px; }
  .track {
    width: 36px; height: 20px; border-radius: 10px;
    background: var(--input-border);
    transition: background var(--duration-fast) var(--ease-out-soft);
  }
  .thumb {
    position: absolute; left: calc(50% - 16px); top: calc(50% - 8px);
    width: 16px; height: 16px; border-radius: 50%;
    background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: transform var(--duration-base) var(--ease-spring);
  }
  button:active .thumb { transform: scaleX(1.15); transform-origin: left; }
  :host([checked]) .track { background: var(--color-primary); }
  :host([checked]) .thumb { transform: translateX(16px); }
  :host([checked]) button:active .thumb { transform: translateX(16px) scaleX(1.15); transform-origin: right; }
`;

export class AxToggle extends BaseComponent {
  static formAssociated = true;
  static observedAttributes = ['checked', 'disabled', 'label'];

  constructor() {
    super();
    this._internals = this.attachInternals();
    this.addStyles(CSS);
  }

  get checked() { return this.hasAttribute('checked'); }
  set checked(v) { this.toggleAttribute('checked', Boolean(v)); }

  attributeChangedCallback() {
    if (this._btn) this._syncState();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <button type="button" role="switch" part="button">
        <span class="track" part="track"></span>
        <span class="thumb" part="thumb"></span>
      </button>`;
    this._btn = this.shadowRoot.querySelector('button');
    this._btn.addEventListener('click', () => {
      this.checked = !this.checked;
      this.dispatchEvent(new CustomEvent('change', {
        bubbles: true, composed: true, detail: { checked: this.checked }
      }));
    });
    this._syncState();
  }

  _syncState() {
    this._btn.setAttribute('aria-checked', String(this.checked));
    this._btn.setAttribute('aria-label', this.getAttribute('label') || 'Toggle');
    this._btn.disabled = this.hasAttribute('disabled');
    this._internals.setFormValue(this.checked ? (this.getAttribute('value') || 'on') : null);
  }
}

customElements.define('ax-toggle', AxToggle);
```

- [ ] **Step 3: Verify in browser console**

On http://localhost:3000 run:

```js
await import('/src/shared/controls/ax-toggle.js');
const t = document.createElement('ax-toggle'); t.setAttribute('label', 'Demo');
document.body.appendChild(t);
t.addEventListener('change', e => console.log('change', e.detail));
```

Click it: thumb springs across with visible overshoot, track cross-fades to primary, console logs `change {checked: true}`. Tab to it: focus ring visible; Space toggles. Set `document.documentElement.dataset.motion = 'reduced'` → toggling is instant; delete the attribute → springy again.

- [ ] **Step 4: Commit**

```bash
git add src/shared/base-component.js src/shared/controls/ax-toggle.js
git commit -m "feat(controls): ax-toggle springy switch + BaseComponent._esc helper"
```

---

### Task 4: `ax-slider`

**Files:**
- Create: `src/shared/controls/ax-slider.js`

**Interfaces:**
- Produces: `<ax-slider>` — attrs `min` (default 0), `max` (default 100), `step` (default 1), `value`, `label`, `name`, `disabled`; property `value` (get/set number, setter animates the fill); emits `input` (every move) and `change` (on release), both `bubbles, composed, detail: { value }`; formAssociated.
- Built on a native `<input type="range">` (native drag/touch/keyboard/a11y), fully restyled.

- [ ] **Step 1: Create `src/shared/controls/ax-slider.js`**

```js
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
  }
  input:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: 8px; }
  input::-webkit-slider-runnable-track {
    height: 4px; border-radius: 2px;
    background: linear-gradient(to right,
      var(--color-primary) var(--fill, 0%), var(--input-border) var(--fill, 0%));
  }
  input::-webkit-slider-thumb {
    -webkit-appearance: none; width: 16px; height: 16px; margin-top: -6px;
    border-radius: 50%; background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: transform var(--duration-fast) var(--ease-spring);
  }
  input:active::-webkit-slider-thumb { transform: scale(1.4); }
  input::-moz-range-track { height: 4px; border-radius: 2px; background: var(--input-border); }
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
    this._internals.setFormValue(String(this.value));
  }
}

customElements.define('ax-slider', AxSlider);
```

- [ ] **Step 2: Verify in browser console**

```js
await import('/src/shared/controls/ax-slider.js');
const s = document.createElement('ax-slider');
s.setAttribute('label', 'Volume'); s.setAttribute('value', '30');
s.style.cssText = 'width:300px;display:block;margin:40px';
document.body.appendChild(s);
s.addEventListener('input', e => console.log(e.detail.value));
```

Drag: fill tracks the thumb, thumb springs to 1.4× while held, bubble pops in showing the value and follows. Keyboard arrows work. Release: bubble fades out. Touch-emulation drag (DevTools device mode) works.

- [ ] **Step 3: Commit**

```bash
git add src/shared/controls/ax-slider.js
git commit -m "feat(controls): ax-slider styled range with fill track, spring thumb, value bubble"
```

---

### Task 5: `ax-dipswitch`

**Files:**
- Create: `src/shared/controls/ax-dipswitch.js`

**Interfaces:**
- Consumes: `<ax-toggle>` (Task 3) — composed internally.
- Produces: `<ax-dipswitch>` — attr `switches` (comma list of labels, e.g. `"DEBUG,TRACE,MOCK"`), attr `on` (comma list of initially-on labels); property `value` → `{ [label]: boolean }`; method `setAll(map, { stagger = 40 } = {})` (staggered spring settle); emits `change` (`bubbles, composed, detail: { label, checked, value }`); formAssociated (submits JSON of the map).

- [ ] **Step 1: Create `src/shared/controls/ax-dipswitch.js`**

```js
/**
 * <ax-dipswitch> — hardware-style bank of labeled toggles.
 * switches="DEBUG,TRACE,MOCK" on="DEBUG"  →  vertical rockers, mono labels.
 */
import { BaseComponent } from '@shared/base-component.js';
import './ax-toggle.js';

const CSS = `
  :host { display: inline-flex; }
  .bank {
    display: inline-flex; gap: var(--space-2xs);
    padding: var(--space-xs) var(--space-s);
    background: var(--input-bg); border: 1px solid var(--input-border);
    border-radius: 8px;
  }
  .dip {
    display: flex; flex-direction: column; align-items: center;
    gap: var(--space-2xs); min-width: 44px;
  }
  .dip ax-toggle { rotate: -90deg; margin: 6px 0; }
  .dip .dip-label {
    font-family: var(--font-mono); font-size: var(--text-xs);
    letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--color-muted); user-select: none;
  }
`;

export class AxDipswitch extends BaseComponent {
  static formAssociated = true;

  constructor() {
    super();
    this._internals = this.attachInternals();
    this.addStyles(CSS);
  }

  get value() {
    const map = {};
    this.shadowRoot.querySelectorAll('ax-toggle').forEach(t => {
      map[t.dataset.label] = t.checked;
    });
    return map;
  }

  setAll(map, { stagger = 40 } = {}) {
    let i = 0;
    this.shadowRoot.querySelectorAll('ax-toggle').forEach(t => {
      const target = Boolean(map[t.dataset.label]);
      if (t.checked !== target) setTimeout(() => { t.checked = target; }, i++ * stagger);
    });
    setTimeout(() => this._internals.setFormValue(JSON.stringify(this.value)), i * stagger + 1);
  }

  render() {
    const labels = (this.getAttribute('switches') || '').split(',').map(s => s.trim()).filter(Boolean);
    const on = new Set((this.getAttribute('on') || '').split(',').map(s => s.trim()));
    this.shadowRoot.innerHTML = `
      <div class="bank" part="bank" role="group" aria-label="${this._esc(this.getAttribute('label') || 'DIP switches')}">
        ${labels.map(l => `
          <div class="dip">
            <ax-toggle data-label="${this._esc(l)}" label="${this._esc(l)}" ${on.has(l) ? 'checked' : ''}></ax-toggle>
            <span class="dip-label">${this._esc(l)}</span>
          </div>`).join('')}
      </div>`;

    this.shadowRoot.addEventListener('change', e => {
      const toggle = e.target.closest?.('ax-toggle') || e.target;
      if (toggle.tagName !== 'AX-TOGGLE') return;
      e.stopPropagation();
      this._internals.setFormValue(JSON.stringify(this.value));
      this.dispatchEvent(new CustomEvent('change', {
        bubbles: true, composed: true,
        detail: { label: toggle.dataset.label, checked: toggle.checked, value: this.value }
      }));
    });
    this._internals.setFormValue(JSON.stringify(this.value));
  }
}

customElements.define('ax-dipswitch', AxDipswitch);
```

- [ ] **Step 2: Verify in browser console**

```js
await import('/src/shared/controls/ax-dipswitch.js');
const d = document.createElement('ax-dipswitch');
d.setAttribute('switches', 'DEBUG,TRACE,MOCK,SAFE'); d.setAttribute('on', 'DEBUG');
document.body.appendChild(d);
d.addEventListener('change', e => console.log(e.detail));
d.value; // → {DEBUG: true, TRACE: false, MOCK: false, SAFE: false}
d.setAll({ DEBUG: false, TRACE: true, MOCK: true, SAFE: true });
```

Looks like a DIP bank: vertical rockers, mono labels beneath. Each flip springs; `setAll` cascades with a visible stagger. Tab reaches each switch individually.

- [ ] **Step 3: Commit**

```bash
git add src/shared/controls/ax-dipswitch.js
git commit -m "feat(controls): ax-dipswitch hardware-style toggle bank with staggered setAll"
```

---

### Task 6: `ax-progress` + `ax-skeleton`

**Files:**
- Create: `src/shared/controls/ax-progress.js`
- Create: `src/shared/controls/ax-skeleton.js`

**Interfaces:**
- Produces: `<ax-progress>` — attrs `value` (0–100, clamped; NaN → indeterminate), `max` (default 100), `indeterminate` (boolean), `label`; property `value` (setter tweens — never jumps); ARIA progressbar via ElementInternals.
- Produces: `<ax-skeleton>` — shimmer placeholder block sized by consumer CSS (host is `display: block`); boolean attr `done` cross-fades it out then removes it from layout (allow-discrete).

- [ ] **Step 1: Create `src/shared/controls/ax-progress.js`**

```js
/**
 * <ax-progress> — determinate (tweened, never jumps) + indeterminate bar.
 */
import { BaseComponent } from '@shared/base-component.js';

const CSS = `
  :host { display: block; width: 100%; }
  .track {
    height: 6px; border-radius: 3px; overflow: hidden;
    background: var(--input-border);
  }
  .fill {
    height: 100%; border-radius: 3px; background: var(--color-primary);
    transform-origin: left; transform: scaleX(var(--p, 0));
    transition: transform var(--duration-slow) var(--ease-out-soft);
  }
  :host([indeterminate]) .fill {
    transform: none; width: 40%;
    animation: ax-indeterminate 1.4s var(--ease-cinematic) infinite; /* motion-gate: allow */
  }
  @keyframes ax-indeterminate {
    from { translate: -100% 0; }
    to { translate: 250% 0; }
  }
`;

export class AxProgress extends BaseComponent {
  static observedAttributes = ['value', 'indeterminate', 'label'];

  constructor() {
    super();
    this._internals = this.attachInternals();
    this._internals.role = 'progressbar';
    this.addStyles(CSS);
  }

  get value() { return this._value ?? 0; }
  set value(v) { this.setAttribute('value', v); }

  attributeChangedCallback() {
    if (this._fill) this._sync();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <div class="track" part="track"><div class="fill" part="fill"></div></div>`;
    this._fill = this.shadowRoot.querySelector('.fill');
    this._sync();
  }

  _sync() {
    const max = Number(this.getAttribute('max')) || 100;
    const raw = Number(this.getAttribute('value'));
    const indeterminate = this.hasAttribute('indeterminate') || Number.isNaN(raw);
    this._internals.ariaLabel = this.getAttribute('label') || 'Progress';
    if (indeterminate) {
      this.toggleAttribute('indeterminate', true);
      this._internals.ariaValueNow = null;
      return;
    }
    this._value = Math.min(max, Math.max(0, raw));
    const pct = this._value / max;
    this._fill.style.setProperty('--p', String(pct));
    this._internals.ariaValueMin = '0';
    this._internals.ariaValueMax = String(max);
    this._internals.ariaValueNow = String(this._value);
  }
}

customElements.define('ax-progress', AxProgress);
```

- [ ] **Step 2: Create `src/shared/controls/ax-skeleton.js`**

```js
/**
 * <ax-skeleton> — shimmer placeholder. Size via consumer CSS.
 * Set the `done` attribute when real content arrives: fades out, then
 * leaves layout (display transition, allow-discrete — no hard cut).
 */
import { BaseComponent } from '@shared/base-component.js';

const CSS = `
  :host {
    display: block; position: relative; overflow: hidden;
    min-height: 1em; border-radius: 8px;
    background: var(--input-bg);
    transition: opacity var(--duration-base) var(--ease-out-soft),
      display var(--duration-base) allow-discrete;
  }
  :host::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.07), transparent);
    translate: -100% 0;
    animation: ax-shimmer 1.6s var(--ease-cinematic) infinite; /* motion-gate: allow */
  }
  @keyframes ax-shimmer { to { translate: 100% 0; } }
  :host([done]) { opacity: 0; display: none; }
`;

export class AxSkeleton extends BaseComponent {
  constructor() {
    super();
    this.addStyles(CSS);
    this.setAttribute('aria-hidden', 'true');
  }
  render() { this.shadowRoot.innerHTML = ''; }
}

customElements.define('ax-skeleton', AxSkeleton);
```

- [ ] **Step 3: Verify in browser console**

```js
await import('/src/shared/controls/ax-progress.js');
await import('/src/shared/controls/ax-skeleton.js');
const p = document.createElement('ax-progress'); p.setAttribute('value', '20');
const k = document.createElement('ax-skeleton'); k.style.cssText = 'width:280px;height:60px;margin:20px';
document.body.append(p, k);
setTimeout(() => { p.value = 85; }, 800);      // fill TWEENS to 85 — no jump
setTimeout(() => k.setAttribute('done', ''), 2000); // shimmer fades, then collapses
p.setAttribute('indeterminate', '');           // sweeping loop
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/controls/ax-progress.js src/shared/controls/ax-skeleton.js
git commit -m "feat(controls): ax-progress tweened bar + ax-skeleton shimmer with animated exit"
```

---

### Task 7: `ax-button`

**Files:**
- Create: `src/shared/controls/ax-button.js`
- Modify: `src/shared/styles/theme.css` (`.btn` transition — name properties instead of `all`, if Task 2 hasn't already)

**Interfaces:**
- Produces: `<ax-button>` — attrs `variant` (`fill` default | `outline` | `ghost`), `tone` (`primary` default | `secondary` | `success` | `warning` | `danger`), `type` (`button` default | `submit`), `loading` (boolean), `disabled`; slotted label; native `click` bubbles from the host; `type="submit"` submits the containing form; formAssociated. Reuses the global `.btn` classes (theme.css is adopted into every BaseComponent shadow root, so they apply inside).

- [ ] **Step 1: Ensure `.btn` in theme.css transitions named properties** (Task 2 mapping already requires no-`all`; confirm the line reads):

```css
  transition: transform var(--duration-fast) var(--ease-spring),
    box-shadow var(--duration-base) var(--ease-out-soft),
    filter var(--duration-base) var(--ease-out-soft),
    background var(--duration-base) var(--ease-out-soft);
```

- [ ] **Step 2: Create `src/shared/controls/ax-button.js`**

```js
/**
 * <ax-button variant="fill|outline|ghost" tone="primary|..." loading>
 * Wraps the house .btn styles (adopted theme.css) + press physics + loading state.
 */
import { BaseComponent } from '@shared/base-component.js';

const CSS = `
  :host { display: inline-flex; }
  :host([disabled]), :host([loading]) { pointer-events: none; }
  :host([disabled]) { opacity: 0.5; }
  .btn { position: relative; min-height: 44px; }
  .btn:active { transform: scale(0.96); }
  .label {
    display: inline-flex; align-items: center; gap: 0.6em;
    transition: opacity var(--duration-fast) var(--ease-out-soft);
  }
  .spinner {
    position: absolute; inset: 0; display: flex;
    align-items: center; justify-content: center;
    opacity: 0;
    transition: opacity var(--duration-fast) var(--ease-out-soft);
  }
  .spinner::after {
    content: ''; width: 1.1em; height: 1.1em; border-radius: 50%;
    border: 2px solid currentColor; border-right-color: transparent;
    animation: ax-spin 0.8s linear infinite; /* motion-gate: allow */
  }
  @keyframes ax-spin { to { rotate: 360deg; } }
  :host([loading]) .label { opacity: 0; }
  :host([loading]) .spinner { opacity: 1; }
`;

export class AxButton extends BaseComponent {
  static formAssociated = true;
  static observedAttributes = ['loading', 'disabled'];

  constructor() {
    super();
    this._internals = this.attachInternals();
    this.addStyles(CSS);
  }

  attributeChangedCallback() {
    if (this._btn) this._btn.disabled = this.hasAttribute('disabled') || this.hasAttribute('loading');
  }

  render() {
    const variant = this.getAttribute('variant') || 'fill';
    const tone = this.getAttribute('tone') || 'primary';
    this.shadowRoot.innerHTML = `
      <button class="btn btn-${this._esc(variant)} btn-${this._esc(tone)}" part="button">
        <span class="label" part="label"><slot></slot></span>
        <span class="spinner" aria-hidden="true"></span>
      </button>`;
    this._btn = this.shadowRoot.querySelector('button');
    this._btn.disabled = this.hasAttribute('disabled') || this.hasAttribute('loading');
    this._btn.addEventListener('click', () => {
      if ((this.getAttribute('type') || 'button') === 'submit') {
        this._internals.form?.requestSubmit();
      }
    });
  }
}

customElements.define('ax-button', AxButton);
```

- [ ] **Step 3: Verify in browser console**

```js
await import('/src/shared/controls/ax-button.js');
const b = document.createElement('ax-button'); b.textContent = 'Deploy';
document.body.appendChild(b);
b.addEventListener('click', () => {
  b.setAttribute('loading', '');
  setTimeout(() => b.removeAttribute('loading'), 1500);
});
```

Looks like a house `.btn-fill` (glow, gradient). Press: scales down, springs back on release. Click: label cross-fades to spinner, back after 1.5s. `b.setAttribute('variant','outline')` + re-append renders the outline style.

- [ ] **Step 4: Commit**

```bash
git add src/shared/controls/ax-button.js src/shared/styles/theme.css
git commit -m "feat(controls): ax-button with press physics and loading cross-fade"
```

---

### Task 8: `ax-popover`

**Files:**
- Create: `src/shared/controls/ax-popover.js`

**Interfaces:**
- Produces: `<ax-popover>` — methods `show(invoker?)`, `hide()`, `toggle(invoker?)`; reflected boolean attr `open`; slotted content (stays in consumer's tree, so consumer CSS styles it); emits `popover-open` / `popover-close` (`bubbles, composed`); light-dismiss (outside pointerdown, Escape); returns focus to invoker on hide; **animated in AND out** (`@starting-style` + `allow-discrete`); sets `data-placement="below"` on itself if there's no room above (consumer may restyle).
- Positioning contract: the HOST is `position: absolute`; the consumer positions it (e.g. `bottom: calc(100% + var(--space-s)); right: 0;`) within a `position: relative` ancestor.

- [ ] **Step 1: Create `src/shared/controls/ax-popover.js`**

```js
/**
 * <ax-popover> — anchored panel. Scale-pops from its origin, animates BOTH
 * directions (no display:none hard cut), light-dismiss, focus-managed.
 */
import { BaseComponent } from '@shared/base-component.js';

const CSS = `
  :host {
    position: absolute; z-index: 101;
    display: none; opacity: 0;
    transform: scale(0.92) translateY(6px);
    transform-origin: var(--ax-popover-origin, bottom right);
    transition: opacity var(--duration-fast) var(--ease-out-soft),
      transform var(--duration-base) var(--ease-spring-gentle),
      display var(--duration-base) allow-discrete;
  }
  :host([open]) { display: block; opacity: 1; transform: none; }
  @starting-style {
    :host([open]) { opacity: 0; transform: scale(0.92) translateY(6px); }
  }
  :host([data-placement="below"]) { transform-origin: var(--ax-popover-origin, top right); }
  .panel {
    min-width: 180px;
    background: var(--dock-bg);
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--dock-border); border-radius: 12px;
    padding: var(--space-m);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    display: flex; flex-direction: column; gap: var(--space-s);
  }
`;

export class AxPopover extends BaseComponent {
  constructor() {
    super();
    this.addStyles(CSS);
    this._onDocPointerDown = (e) => {
      const path = e.composedPath();
      if (path.includes(this)) return;
      if (this._invoker && path.includes(this._invoker)) return; // let invoker toggle
      this.hide();
    };
    this._onDocKeydown = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); this.hide(); }
    };
  }

  render() {
    this.shadowRoot.innerHTML = `<div class="panel" part="panel"><slot></slot></div>`;
  }

  get open() { return this.hasAttribute('open'); }

  show(invoker) {
    if (this.open) return;
    this._invoker = invoker || null;
    this.setAttribute('open', '');
    this._invoker?.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', this._onDocPointerDown, true);
    document.addEventListener('keydown', this._onDocKeydown, true);
    requestAnimationFrame(() => {
      // Viewport flip: if the panel's top is clipped, reopen below the anchor.
      const rect = this.getBoundingClientRect();
      if (rect.top < 8) this.dataset.placement = 'below';
      const first = this.querySelector(
        'ax-toggle, ax-slider, ax-button, button, [href], input, select, [tabindex]');
      first?.focus();
    });
    this.dispatchEvent(new CustomEvent('popover-open', { bubbles: true, composed: true }));
  }

  hide() {
    if (!this.open) return;
    this.removeAttribute('open');
    delete this.dataset.placement;
    document.removeEventListener('pointerdown', this._onDocPointerDown, true);
    document.removeEventListener('keydown', this._onDocKeydown, true);
    this._invoker?.setAttribute('aria-expanded', 'false');
    this._invoker?.focus();
    this._invoker = null;
    this.dispatchEvent(new CustomEvent('popover-close', { bubbles: true, composed: true }));
  }

  toggle(invoker) { this.open ? this.hide() : this.show(invoker); }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('pointerdown', this._onDocPointerDown, true);
    document.removeEventListener('keydown', this._onDocKeydown, true);
  }
}

customElements.define('ax-popover', AxPopover);
```

- [ ] **Step 2: Verify in browser console**

```js
await import('/src/shared/controls/ax-popover.js');
const wrap = document.createElement('div');
wrap.style.cssText = 'position:fixed;bottom:80px;left:50%;';
wrap.innerHTML = `<button id="pv-btn">menu</button>
  <ax-popover><div>Hello</div><button>Item</button></ax-popover>`;
document.body.appendChild(wrap);
const pop = wrap.querySelector('ax-popover');
wrap.querySelector('#pv-btn').onclick = (e) => pop.toggle(e.currentTarget);
```

Open: panel scale-pops up with a gentle spring. Click outside: it animates OUT (shrink + fade — watch for this specifically; it must NOT vanish instantly). Escape closes and focus returns to the button. Clicking the invoker while open closes it (no reopen flicker).

- [ ] **Step 3: Commit**

```bash
git add src/shared/controls/ax-popover.js
git commit -m "feat(controls): ax-popover with animated exit, light dismiss, focus return"
```

---

### Task 9: Dock retrofit — popover settings, sliding pill, press feedback

**Files:**
- Modify: `src/features/navigation/nav-dock.js`
- Modify: `src/features/navigation/navigation.css`

**Interfaces:**
- Consumes: `ax-popover`, `ax-toggle`, `ax-slider`.
- Produces: same external behavior (state keys `theme`, `captionsEnabled`, `audioLevel` still driven by the dock) — features/other consumers unaffected.

- [ ] **Step 1: navigation.css — remove the hand-rolled menu/toggle CSS, add pill + press + popover placement**

DELETE these rules (now dead): `.settings-menu`, `.settings-menu.hidden`, `@keyframes settingsSlideUp`, `.toggle-switch`, `.toggle-input`, `.toggle-track`, `.toggle-thumb`, `.toggle-input:checked+.toggle-track`, `.toggle-input:checked+.toggle-track .toggle-thumb`, `.settings-row input[type="range"]`.

KEEP `.settings-row`, `.settings-icon` (rows are slotted light-DOM children of the popover, styled by this sheet). Add:

```css
/* Popover placement above the dock (host positioning contract) */
ax-popover {
  bottom: calc(100% + var(--space-s));
  right: 0;
  min-width: 200px;
}

.settings-row ax-slider { flex: 1; }

/* Sliding active pill */
.dock-pill {
  position: absolute; left: 0; top: 0;
  border-radius: var(--space-s);
  background: rgba(168, 85, 247, 0.1);
  opacity: 0; pointer-events: none;
  transition: transform var(--duration-base) var(--ease-spring),
    width var(--duration-base) var(--ease-spring),
    opacity var(--duration-fast) var(--ease-out-soft);
}
.nav-link { position: relative; }  /* paint above the pill */
```

In the existing `.nav-link` rule, replace `transition: all 0.2s ease;` (retokenized in Task 2 — now make it) with:

```css
  transition: color var(--duration-fast) var(--ease-out-soft),
    background var(--duration-fast) var(--ease-out-soft),
    transform var(--duration-fast) var(--ease-spring);
```

and add press feedback + drop the static active background (the pill replaces it):

```css
.nav-link:active { transform: scale(0.88); }
.nav-link.active { color: var(--color-primary); background: transparent; }
```

- [ ] **Step 2: nav-dock.js — imports, popover markup, pill logic, surgical theme sync**

Top of file add:

```js
import '@shared/controls/ax-popover.js';
import '@shared/controls/ax-toggle.js';
import '@shared/controls/ax-slider.js';
```

In `connectedCallback`, change the state subscription: `theme` must NOT full-re-render (it would slam the popover shut mid-toggle); sync surgically. `user` still re-renders:

```js
    this._cleanup = state.subscribe(({ key, value }) => {
      if (key === 'route') this.updateActive(value);
      if (key === 'user') this.render();
      if (key === 'theme') this._syncThemeIcon(value);
      if (key === 'audioLevel') {
        const slider = this.shadowRoot.querySelector('.audio-slider');
        if (slider) slider.value = value;
      }
      if (key === 'captionsEnabled') {
        const t = this.shadowRoot.querySelector('.captions-toggle');
        if (t) t.checked = value;
      }
    });
```

Replace the settings-button click handling + manual outside-close logic in the click listener with (popover handles its own dismissal):

```js
    this.shadowRoot.addEventListener('click', e => {
      if (e.target.closest('.settings-btn')) {
        e.preventDefault();
        e.stopPropagation();
        const pop = this.shadowRoot.querySelector('ax-popover');
        pop?.toggle(this.shadowRoot.querySelector('.settings-btn'));
        return;
      }
      if (e.composedPath().some(el => el.tagName === 'AX-POPOVER')) return;
      const link = e.target.closest('a');
      if (link && link.getAttribute('href') === state.data.route) {
        e.preventDefault();
        return;
      }
      router.handleIntercept(e);
    });
```

Replace the input/change delegated handlers (events from `ax-*` carry `detail`):

```js
    this.shadowRoot.addEventListener('input', e => {
      if (e.target.classList?.contains('audio-slider')) {
        state.data.audioLevel = e.detail.value;
      }
    });
    this.shadowRoot.addEventListener('change', e => {
      if (e.target.classList?.contains('captions-toggle')) {
        state.data.captionsEnabled = e.detail.checked;
      }
      if (e.target.classList?.contains('theme-toggle')) {
        state.data.theme = e.detail.checked ? 'dark' : 'light';
      }
    });
```

In `render()`, inside `.dock-wrapper` as the FIRST child add `<span class="dock-pill" aria-hidden="true"></span>`, and replace the whole `<div class="settings-menu hidden" ...>...</div>` block with:

```html
      <ax-popover aria-label="Settings">
        <div class="settings-row" title="Appearance">
          <svg class="settings-icon theme-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${this._themeIconPath(isDark)}</svg>
          <ax-toggle class="theme-toggle" label="Toggle dark mode" ${isDark ? 'checked' : ''}></ax-toggle>
        </div>
        <div class="settings-row" title="Audio">
          <svg class="settings-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
          </svg>
          <ax-slider class="audio-slider" label="Audio level" min="0" max="100" value="${state.data.audioLevel}"></ax-slider>
        </div>
        <div class="settings-row" title="Closed Captions">
          <svg class="settings-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"></rect>
            <text x="6" y="15" font-size="9" font-weight="700" fill="currentColor" stroke="none" font-family="sans-serif">CC</text>
          </svg>
          <ax-toggle class="captions-toggle" label="Toggle captions" ${state.data.captionsEnabled ? 'checked' : ''}></ax-toggle>
        </div>
      </ax-popover>
```

The rows slot into the popover; the sun/moon SVG inner markup moves to a helper (used by render AND surgical sync):

```js
  _themeIconPath(isDark) {
    return isDark
      ? `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`
      : `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
  }

  _syncThemeIcon(theme) {
    const icon = this.shadowRoot.querySelector('.theme-icon');
    if (icon) icon.innerHTML = this._themeIconPath(theme === 'dark');
    const t = this.shadowRoot.querySelector('.theme-toggle');
    if (t) t.checked = theme === 'dark';
  }
```

- [ ] **Step 3: Pill positioning**

At the end of `render()` (after `this.updateActive(state.data.route);`) also add a resize handler once in `connectedCallback`:

```js
    this._onResize = () => this._positionPill(false);
    window.addEventListener('resize', this._onResize);
```

(and `window.removeEventListener('resize', this._onResize);` in `disconnectedCallback`). Change `updateActive` to end with `this._positionPill(true);`, change the call at the end of `render()` to `this.updateActive(state.data.route); this._positionPill(false);`, and add:

```js
  /**
   * Springy indicator: measure the active link and glide the pill to it.
   * animate=false snaps (initial paint, resize) — no transition flash.
   */
  _positionPill(animate = true) {
    const pill = this.shadowRoot.querySelector('.dock-pill');
    const wrapper = this.shadowRoot.querySelector('.dock-wrapper');
    const active = this.shadowRoot.querySelector('.nav-link.active');
    if (!pill || !wrapper) return;
    if (!active) { pill.style.opacity = '0'; return; }
    const w = wrapper.getBoundingClientRect();
    const r = active.getBoundingClientRect();
    if (!animate) pill.style.transition = 'none';
    pill.style.opacity = '1';
    pill.style.width = `${r.width}px`;
    pill.style.height = `${r.height}px`;
    pill.style.transform = `translate(${r.left - w.left}px, ${r.top - w.top}px)`;
    if (!animate) requestAnimationFrame(() => { pill.style.transition = ''; });
  }
```

- [ ] **Step 4: Verify in browser**

Hard-reload http://localhost:3000. Check ALL of:
1. Navigate home → dashboard → contact: the pill glides between icons with spring overshoot; the old static purple background is gone (pill IS the highlight).
2. Press an icon: it scales down and springs back.
3. Settings gear: popover scale-pops up; theme/captions toggles spring; audio slider shows bubble while dragging.
4. **Toggle dark mode from inside the menu: the menu STAYS OPEN**, icon flips sun/moon, page cross-fades themes.
5. Click outside: menu animates closed (shrink + fade, not instant). Escape does the same and refocuses the gear.
6. Mobile width (DevTools ≤768px): dock fits, targets comfortable, pill still tracks.
7. Route transitions still slide (no second `view-transition-name` was introduced; dock stays outside `#app-container`).

- [ ] **Step 5: Commit**

```bash
git add src/features/navigation/nav-dock.js src/features/navigation/navigation.css
git commit -m "feat(dock): ax-popover settings menu, springy sliding pill, press feedback"
```

---

### Task 10: `/components` showcase route

**Files:**
- Create: `src/features/components/components.js`, `src/features/components/components.css` (scaffold: `node tools/create-feature.js components`, then overwrite; DELETE the scaffolded `components-api.js` — this page has no API)
- Modify: `src/app-routes.js`
- Modify: `src/features/navigation/nav-dock.js` (add dock link)

**Interfaces:**
- Consumes: every `ax-*` control (Tasks 3–8), motion tokens (Task 1), `[data-motion="reduced"]` hook (Task 1).
- Produces: route `components` (`<components-ui>`), a dock nav-link to it.

- [ ] **Step 1: Scaffold, then register the route**

Run: `node tools/create-feature.js components` (from project root). Delete `src/features/components/components-api.js`. In `src/app-routes.js`:

```js
export const ROUTE_DEPTHS = { 'home': 0, 'default': 1 };
export const ROUTE_ORDER = ['home', 'counter', 'dashboard', 'components'];
export const DEFAULT_ROUTE = 'home';

export const ROUTES = {
  'home': { path: '@features/home/home.js' },
  'counter': { path: '@features/counter/counter.js' },
  'dashboard': {
    path: '@features/dashboard/dashboard.js',
    api: () => import('@features/dashboard/dashboard-api.js').then(m => m.fetchDashboardData()),
    dataKey: 'dashboardData'
  },
  'components': { path: '@features/components/components.js' },
  'contact': { path: '@features/contact/contact.js' },
  'navigation': { path: '@features/navigation/navigation.js' },
  'not-found': { path: '@features/not-found/not-found.js' }
};
```

- [ ] **Step 2: Write `src/features/components/components.js`**

```js
/**
 * <components-ui> — living showcase of the Axiom motion system + ax-* controls.
 * Fleet reference page: every control live, tokens visualized, transitions linked.
 */
import { BaseComponent } from '@shared/base-component.js';
import '@shared/controls/ax-toggle.js';
import '@shared/controls/ax-dipswitch.js';
import '@shared/controls/ax-slider.js';
import '@shared/controls/ax-progress.js';
import '@shared/controls/ax-button.js';
import '@shared/controls/ax-popover.js';
import '@shared/controls/ax-skeleton.js';

const DURATIONS = ['instant', 'fast', 'base', 'slow'];
const EASINGS = ['ease-spring', 'ease-spring-gentle', 'ease-out-soft', 'ease-cinematic'];

export class ComponentsUI extends BaseComponent {
  async connectedCallback() {
    await this.addExternalStyles(new URL('./components.css', import.meta.url).href);
    super.connectedCallback();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <main class="page">
        <h1>Components &amp; Motion</h1>
        <p class="motto">Hard rule: no fast default vanilla behavior. Everything animates.</p>

        <section class="glass-card">
          <h2>Reduced motion</h2>
          <div class="row">
            <ax-toggle class="rm-toggle" label="Preview reduced motion"
              ${document.documentElement.dataset.motion === 'reduced' ? 'checked' : ''}></ax-toggle>
            <span>Preview <code>prefers-reduced-motion</code> — collapses every token to 1ms.</span>
          </div>
        </section>

        <section class="glass-card">
          <h2>Buttons</h2>
          <div class="row">
            <ax-button class="load-demo">Fill (click = loading)</ax-button>
            <ax-button variant="outline" tone="secondary">Outline</ax-button>
            <ax-button variant="ghost">Ghost</ax-button>
            <ax-button tone="danger">Danger</ax-button>
            <ax-button disabled>Disabled</ax-button>
          </div>
        </section>

        <section class="glass-card">
          <h2>Toggle &amp; DIP switch</h2>
          <div class="row">
            <ax-toggle checked label="Single toggle"></ax-toggle>
            <ax-dipswitch class="dip-demo" switches="DEBUG,TRACE,MOCK,SAFE" on="DEBUG" label="Feature flags"></ax-dipswitch>
            <ax-button variant="ghost" class="dip-randomize">Stagger-set</ax-button>
          </div>
        </section>

        <section class="glass-card">
          <h2>Slider &rarr; Progress</h2>
          <ax-slider class="wired-slider" label="Drive the progress bar" value="40"></ax-slider>
          <ax-progress class="wired-progress" value="40" label="Driven progress"></ax-progress>
          <h3>Indeterminate</h3>
          <ax-progress indeterminate label="Loading"></ax-progress>
        </section>

        <section class="glass-card">
          <h2>Skeleton</h2>
          <div class="skeleton-stage">
            <ax-skeleton class="sk"></ax-skeleton>
            <p class="sk-content" hidden>Content arrived — the skeleton faded, no pop-in.</p>
          </div>
          <ax-button variant="outline" class="sk-replay">Replay load</ax-button>
        </section>

        <section class="glass-card">
          <h2>Popover</h2>
          <div class="pop-anchor">
            <ax-button variant="outline" class="pop-btn" aria-haspopup="true" aria-expanded="false">Open popover</ax-button>
            <ax-popover aria-label="Demo menu">
              <div class="settings-like"><ax-toggle label="Option A" checked></ax-toggle> Option A</div>
              <div class="settings-like"><ax-toggle label="Option B"></ax-toggle> Option B</div>
            </ax-popover>
          </div>
        </section>

        <section class="glass-card">
          <h2>Motion tokens</h2>
          <div class="token-grid">
            ${DURATIONS.map(d => `
              <div class="token-row">
                <code>--duration-${d}</code>
                <div class="lane"><div class="ball dur" style="transition-duration: var(--duration-${d})"></div></div>
              </div>`).join('')}
            ${EASINGS.map(e => `
              <div class="token-row">
                <code>--${e}</code>
                <div class="lane"><div class="ball" style="transition-timing-function: var(--${e}); transition-duration: var(--duration-slow)"></div></div>
              </div>`).join('')}
          </div>
          <ax-button variant="ghost" class="replay-tokens">Replay</ax-button>
        </section>

        <section class="glass-card">
          <h2>Route transitions</h2>
          <p>The router picks direction from <code>ROUTE_ORDER</code>: navigating left of this page slides back, right slides forward.</p>
          <div class="row">
            <a href="/home" class="btn btn-outline btn-secondary">&larr; Home (backward)</a>
            <a href="/dashboard" class="btn btn-outline btn-secondary">&larr; Dashboard (backward)</a>
            <a href="/contact" class="btn btn-outline btn-secondary">Contact (forward) &rarr;</a>
          </div>
        </section>
      </main>`;
    this._wire();
  }

  _wire() {
    const $ = (sel) => this.shadowRoot.querySelector(sel);

    $('.rm-toggle').addEventListener('change', e => {
      if (e.detail.checked) document.documentElement.dataset.motion = 'reduced';
      else delete document.documentElement.dataset.motion;
    });

    $('.load-demo').addEventListener('click', e => {
      const b = e.currentTarget;
      b.setAttribute('loading', '');
      setTimeout(() => b.removeAttribute('loading'), 1500);
    });

    $('.dip-randomize').addEventListener('click', () => {
      const dip = $('.dip-demo');
      const next = {};
      Object.keys(dip.value).forEach(k => { next[k] = Math.random() > 0.5; });
      dip.setAll(next);
    });

    $('.wired-slider').addEventListener('input', e => {
      $('.wired-progress').value = e.detail.value;
    });

    const replaySkeleton = () => {
      const sk = $('.sk'), content = $('.sk-content');
      sk.removeAttribute('done'); content.hidden = true;
      setTimeout(() => { sk.setAttribute('done', ''); content.hidden = false; }, 1800);
    };
    $('.sk-replay').addEventListener('click', replaySkeleton);
    replaySkeleton();

    $('.pop-btn').addEventListener('click', e => {
      $('ax-popover').toggle(e.currentTarget);
    });

    const replayTokens = () => {
      this.shadowRoot.querySelectorAll('.ball').forEach(b => b.classList.remove('go'));
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          this.shadowRoot.querySelectorAll('.ball').forEach(b => b.classList.add('go'))));
    };
    $('.replay-tokens').addEventListener('click', replayTokens);
    replayTokens();
  }
}

customElements.define('components-ui', ComponentsUI);
```

- [ ] **Step 3: Write `src/features/components/components.css`**

```css
:host { display: block; }
.page {
  max-width: 760px; margin: 0 auto;
  padding: var(--space-xl) var(--space-m) calc(var(--space-xl) * 3);
  display: flex; flex-direction: column; gap: var(--space-l);
}
.row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-m); }
.settings-like { display: flex; align-items: center; gap: var(--space-s); }
.pop-anchor { position: relative; display: inline-block; }
.pop-anchor ax-popover { bottom: calc(100% + var(--space-s)); left: 0; --ax-popover-origin: bottom left; }
.skeleton-stage { position: relative; min-height: 60px; margin-bottom: var(--space-m); }
.skeleton-stage .sk { position: absolute; inset: 0; }
.token-grid { display: flex; flex-direction: column; gap: var(--space-s); margin-bottom: var(--space-m); }
.token-row { display: grid; grid-template-columns: 220px 1fr; align-items: center; gap: var(--space-m); }
.token-row code { font-size: var(--text-xs); }
.lane {
  position: relative; height: 20px; border-radius: 10px;
  background: var(--input-bg); border: 1px solid var(--input-border);
  container-type: inline-size;
}
.ball {
  position: absolute; top: 2px; left: 2px; width: 14px; height: 14px;
  border-radius: 50%; background: var(--color-primary);
  transition-property: transform;
  transition-duration: var(--duration-base);
  transition-timing-function: var(--ease-spring);
}
.ball.go { transform: translateX(calc(100cqw - 18px)); }
/* Skeleton demo: content fades in — no pop-in (house rule) */
.sk-content { transition: opacity var(--duration-slow) var(--ease-out-soft); }
@starting-style {
  .sk-content:not([hidden]) { opacity: 0; }
}
@media (max-width: 600px) {
  .token-row { grid-template-columns: 1fr; gap: var(--space-2xs); }
}
```

- [ ] **Step 4: Add the dock link** — in `nav-dock.js` `render()`, after the dashboard link:

```html
      <a class="nav-link" href="components" title="Components" aria-label="Components">
        <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2"></rect>
          <path d="M3 9h18"></path><path d="M9 21V9"></path>
        </svg>
      </a>
```

- [ ] **Step 5: Verify in browser**

Navigate to http://localhost:3000/components (direct load AND via dock icon — pill glides to it). Exercise every section: buttons load-state, dipswitch stagger, slider drives progress with tween, skeleton replay (no pop-in), popover in/out both animated, token balls replay (visibly different speeds/curves — spring rows overshoot), route links slide correct directions. Flip the reduced-motion toggle: EVERYTHING on the page becomes instant (balls, toggles, popover); flip back: springy again.

- [ ] **Step 6: Commit**

```bash
git add src/app-routes.js src/features/components src/features/navigation/nav-dock.js
git commit -m "feat(showcase): /components route — live controls, motion tokens, transition demos"
```

---

### Task 11: Final verification, build, MANIFEST

**Files:**
- Modify: `MANIFEST.toml`
- No other source changes expected (fix regressions if found).

- [ ] **Step 1: Full grep gate** (same two commands as Task 2 Step 2). Expected: empty.

- [ ] **Step 2: Full browser walkthrough** (use claude-in-chrome; this is the release gate):
1. Every route via dock: pill glides, transitions slide/fade correctly, no hard cuts.
2. Dock settings: open/close animated both ways; theme toggle keeps menu open; slider bubble; captions toggle.
3. `/components`: every section per Task 10 Step 5.
4. Reduced motion via OS emulation (DevTools → Rendering → prefers-reduced-motion: reduce): whole app instant-but-functional.
5. Mobile width 390px: dock fits, all targets ≥44px, slider draggable by touch emulation.
6. Form participation: in console on any page —
   ```js
   const f = document.createElement('form');
   f.innerHTML = `<ax-toggle name="cc" checked></ax-toggle>`;
   document.body.appendChild(f);
   new FormData(f).get('cc'); // → "on"
   ```
7. Console: zero errors across the walkthrough.

- [ ] **Step 3: Build + tool tests** (from project root, NOT worker/):

```bash
node tools/minify.js
npm run test:tools
```

Expected: build guards pass (single BUILD_ID, no /src/ refs — the new `controls/` dir is under `src/shared/` so it's auto-built and auto-stamped), 13+ tool tests pass.

- [ ] **Step 4: Record the capability in MANIFEST.toml** (append, matching house schema):

```toml
[[capabilities]]
id = "motion-system-control-set"
tags = ["es6", "web-components", "a11y"]
claim = "Motion token layer (CSS linear() springs, 4 durations/4 easings, single reduced-motion collapse point) + seven formAssociated ax-* controls (toggle, dipswitch, slider, progress, button, popover, skeleton) with animated show/hide via @starting-style/allow-discrete; /components showcase route; grep-enforced no-literal-easing rule"
maturity = "shipped"
entry_points = ["src/shared/styles/theme.css", "src/shared/controls/", "src/features/components/components.js", "docs/superpowers/specs/2026-07-17-motion-system-design.md"]
pattern_doc = ""
```

Also bump `updated = "2026-07-17"` in `[project]`.

- [ ] **Step 5: Commit**

```bash
git add MANIFEST.toml
git commit -m "chore: record motion-system-control-set capability; verification pass complete"
```

(Do NOT push or deploy — axiom has dual remotes and a canonical-upstream policy; pushing is the user's call.)
