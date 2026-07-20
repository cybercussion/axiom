# Neu Data-Viz Variants — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `surface="neu"` for seven more controls (barchart, ring, progress-ring, stat, chip, datestrip, popover) + showcase panel + doc/MANIFEST updates.

**Architecture:** Pure-CSS variant blocks appended to each control's `CSS` constant — ZERO JS changes anywhere. Spec: addendum section of `docs/superpowers/specs/2026-07-20-cyber-neumorphism-design.md`.

**Tech Stack:** CSS on existing Web Components. Zero dependencies.

## Global Constraints

- Pure CSS only; zero JS-line changes in any control.
- Palette contract: chart marks (`ax-barchart` fill, `ax-ring` segments) STAY `--chart-*`; glows are decorative and may derive from the chart color; `--accent-glow` is allowed only on control value indicators (progress-ring arc) — never chart marks.
- Motion tokens only; gates stay clean; restraint (no per-segment ring glow).
- Commit per task with the given message. No push/deploy.

---

### Task 1: Chart-family neu variants

**Files:** Modify (CSS append only): `src/shared/controls/ax-barchart.js`, `ax-ring.js`, `ax-progress-ring.js`

- [ ] **Step 1: ax-barchart.js — append before the CSS closing backtick:**

```css
  /* ===== surface="neu" — carved rails; fills stay chart-colored (palette
     contract), glow derives from the chart color itself. ===== */
  :host([surface="neu"]) .rail {
    background: var(--neu-surface-deep);
    box-shadow: var(--neu-well);
  }
  :host([surface="neu"]) .fill {
    box-shadow: 0 0 12px color-mix(in srgb, var(--chart-1) 45%, transparent);
  }
```

- [ ] **Step 2: ax-ring.js — append:**

```css
  /* ===== surface="neu" — circular carved backdrop; segments stay --chart-N,
     no per-segment glow (restraint). ===== */
  :host([surface="neu"]) .stage::before {
    content: ''; position: absolute; inset: -12px; border-radius: 50%;
    background: var(--neu-surface-deep); box-shadow: var(--neu-well);
    z-index: -1;
  }
  :host([surface="neu"]) .rail {
    stroke: color-mix(in srgb, black 25%, var(--neu-surface-deep));
  }
```

- [ ] **Step 3: ax-progress-ring.js — append:**

```css
  /* ===== surface="neu" — control indicator: aurora arc is its intended use. ===== */
  :host([surface="neu"]) .rail { stroke: var(--neu-surface-deep); }
  :host([surface="neu"]) .arc {
    stroke: var(--accent-glow);
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent-glow) 60%, transparent));
  }
  :host([surface="neu"][data-done]) .arc {
    stroke: var(--success-color);
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--success-color) 60%, transparent));
  }
```

- [ ] **Step 4: Gates.** `node --check` all three; `npm run lint:motion` clean; diff shows CSS-only.

- [ ] **Step 5: Commit** — `feat(neu): chart-family surface=neu — carved rails, chart-true fills, aurora progress arc`

---

### Task 2: Furniture neu variants

**Files:** Modify (CSS append only): `src/shared/controls/ax-stat.js`, `ax-chip.js`, `ax-datestrip.js`, `ax-popover.js`

- [ ] **Step 1: ax-stat.js — append:**

```css
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
```

- [ ] **Step 2: ax-chip.js — append:**

```css
  /* ===== surface="neu" — raised pill; tone moves to ink (neu-button pattern). ===== */
  :host([surface="neu"]) .chip {
    background: var(--neu-face); border: none;
    box-shadow: var(--neu-raised-sm);
    color: var(--color-foreground);
  }
  :host([surface="neu"]) .chip.ongoing { color: var(--color-primary); }
  :host([surface="neu"]) .chip.complete { color: var(--success-color); }
```

- [ ] **Step 3: ax-datestrip.js — append:**

```css
  /* ===== surface="neu" — well strip, raised selection puck. ===== */
  :host([surface="neu"]) .strip {
    background: var(--neu-surface-deep); border-radius: 16px;
    box-shadow: var(--neu-well); padding: var(--space-2xs);
  }
  :host([surface="neu"]) .pill {
    background: var(--neu-face); border: none;
    box-shadow: var(--neu-raised-sm);
  }
  :host([surface="neu"]) .nav:hover { background: transparent; color: var(--color-foreground); }
```

- [ ] **Step 4: ax-popover.js — append:**

```css
  /* ===== surface="neu" — opaque raised panel, no backdrop blur. ===== */
  :host([surface="neu"]) .panel {
    background: var(--neu-face); border: none;
    box-shadow: var(--neu-raised), 0 14px 28px var(--neu-dark);
    backdrop-filter: none; -webkit-backdrop-filter: none;
  }
```

- [ ] **Step 5: Gates.** `node --check` all four; `npm run lint:motion` clean; CSS-only diff.

- [ ] **Step 6: Commit** — `feat(neu): furniture surface=neu — stat card, chip pill, datestrip well, opaque popover`

---

### Task 3: Showcase panel + docs + MANIFEST

**Files:** Modify: `src/features/components/components.js`, `components.css`, `docs/CONTROLS.md`, `MANIFEST.toml`

- [ ] **Step 1: components.js — inside the `.neu-stage` div, after the knob panel, add:**

```html
            <div class="neu-panel neu-viz-panel">
              <ax-barchart surface="neu" unit="%" max="100" label="Neu bars"
                data='[{"label":"Mon","value":42},{"label":"Tue","value":68},{"label":"Wed","value":30},{"label":"Thu","value":81},{"label":"Fri","value":55}]'></ax-barchart>
              <div class="neu-viz-row">
                <ax-ring surface="neu" size="120" label="Neu ring"
                  segments='[{"label":"Move","value":50},{"label":"Rest","value":30},{"label":"Focus","value":20}]'>
                  <span class="ring-pct">64%</span>
                </ax-ring>
                <ax-progress-ring surface="neu" value="83" size="56" label="Neu gauge"></ax-progress-ring>
                <ax-progress-ring surface="neu" value="100" size="56" label="Neu done"></ax-progress-ring>
              </div>
              <div class="neu-viz-row">
                <ax-stat surface="neu" value="7,412" label="Steps">
                  <svg slot="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4v6l4 2"></path><circle cx="12" cy="12" r="10"></circle></svg>
                </ax-stat>
                <ax-chip surface="neu" tone="complete">Complete</ax-chip>
                <ax-chip surface="neu" tone="ongoing">On Going</ax-chip>
              </div>
              <ax-datestrip surface="neu" label="Neu week"></ax-datestrip>
            </div>
```

(No wiring — static demo; the JSON attributes deliberately exercise the attribute pathway.)

- [ ] **Step 2: components.css — append:**

```css
.neu-viz-panel { display: flex; flex-direction: column; gap: var(--space-m); min-width: 300px; flex: 1; }
.neu-viz-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-m); }
```

- [ ] **Step 3: docs/CONTROLS.md** — add `surface="neu"` to the Variants cell of the seven rows (barchart, ring, progress-ring, stat, chip, datestrip, popover), phrasing consistent with existing variant cells.

- [ ] **Step 4: MANIFEST.toml** — in the `neu-surface-tier` claim, after `tilting rocker dipswitch)`, insert `, data-viz/furniture neu variants (barchart/ring/progress-ring/stat/chip/datestrip/popover)`.

- [ ] **Step 5: Gates.** `node --check components.js`; `npm run lint:motion`; `npm run build`; `npm run test:tools`.

- [ ] **Step 6: Commit** — `feat(neu): showcase viz panel, CONTROLS.md variant cells, MANIFEST claim — data-viz joins the tier`
