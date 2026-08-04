/**
 * <ax-bento> — pure-layout CSS Grid host for bento compositions.
 * Preset geometry credit: Flexbox Labs (github.com/prazzon/flexbox-labs, MIT) —
 * its "Collage" grid preset, vanilla-ized. Presets here are data; placement is
 * custom-prop indirection; the responsive collapse is ours (they don't have one).
 */
import { BaseComponent } from '@shared/base-component.js';

// Per-preset: tracks + per-slot grid-area strings applied to children by DOM
// index (row-start / col-start / row-end / col-end). null slot = auto-flow.
// Children beyond the slot list auto-flow. DOM order is NEVER changed —
// presets place visually only, so reading/tab order stays source order.
const PRESETS = {
  collage: {
    cols: 4, rows: 4,
    slots: [
      '1 / 1 / 2 / 3', '2 / 2 / 4 / 4', '1 / 3 / 2 / 4',
      '1 / 4 / 3 / 5', '3 / 1 / 5 / 2', '3 / 4 / 4 / 5',
      '4 / 3 / 5 / 5', '4 / 2 / 5 / 3', '2 / 1 / 3 / 2'
    ]
  },
  hero: {
    cols: 3, rows: 3,
    slots: [
      '1 / 1 / 3 / 3', '1 / 3 / 2 / 4', '2 / 3 / 3 / 4',
      '3 / 1 / 4 / 2', '3 / 2 / 4 / 3', '3 / 3 / 4 / 4'
    ]
  },
  dash: {
    cols: '1.2fr 0.8fr 1fr',
    slots: [null, null, null, 'auto / 1 / auto / 3']
  }
};

const CSS = `
  :host { display: block; }
  .grid {
    display: grid;
    grid-template-columns: var(--_cols, repeat(4, minmax(0, 1fr)));
    grid-template-rows: var(--_rows, none);
    grid-auto-rows: auto;
    gap: var(--_gap, var(--space-m));
  }
  slot { display: contents; }
  /* Placement reads private custom props the host writes on children —
     never inline layout styles, so the collapse rules below win by
     specificity instead of fighting element.style. min-width: 0 is the
     grid-item overflow guard (charts/long text can't blow the track). */
  ::slotted(*) { grid-area: var(--_ba, auto); min-width: 0; }
  ::slotted([span]) { grid-column: span var(--_bc, 1); }
  ::slotted([rows]) { grid-row: span var(--_br, 1); }
  /* area beats span/rows on the same child: equal specificity, later
     rule wins per-property (grid-area shorthand covers grid-column/row). */
  ::slotted([area]) { grid-area: var(--_ba, auto); }
  :host([data-collapsed]) .grid {
    grid-template-columns: 1fr;
    grid-template-rows: none;
  }
  :host([data-collapsed]) ::slotted(*) { grid-area: auto; }
`;

export class AxBento extends BaseComponent {
  static observedAttributes = ['cols', 'rows', 'gap', 'preset', 'collapse'];
  // Layout container: never funnel the router's post-navigation focus()
  // into the first focusable tile (dashboard-ui precedent).
  static delegatesFocus = false;

  constructor() {
    super();
    this.addStyles(CSS);
    // Once-per-instance (house invariant); observed on connect.
    // Watches span/rows/area edits on DIRECT children only — host attrs go
    // through attributeChangedCallback, deeper descendants aren't ours.
    this._mo = new MutationObserver(muts => {
      if (muts.some(m => m.target !== this && m.target.parentElement === this)) {
        this._layout();
      }
    });
    this._ro = new ResizeObserver(entries => {
      const e = entries[entries.length - 1];
      this._lastWidth = e.contentBoxSize?.[0]?.inlineSize ?? e.contentRect.width ?? 0;
      this._applyCollapse();
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this._mo.observe(this, {
      attributes: true, subtree: true, attributeFilter: ['span', 'rows', 'area']
    });
    this._ro.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._mo.disconnect();
    this._ro.disconnect();
  }

  attributeChangedCallback(name) {
    if (!this._grid) return;
    if (name === 'collapse') this._applyCollapse();
    else this._layout();
  }

  render() {
    this.shadowRoot.innerHTML = '<div class="grid" part="grid"><slot></slot></div>';
    this._grid = this.shadowRoot.querySelector('.grid');
    this._slot = this.shadowRoot.querySelector('slot');
    this._slot.addEventListener('slotchange', () => this._layout());
    this._layout();
  }

  _layout() {
    if (!this._grid) return; // MO can fire in the async gap before first render
    const preset = PRESETS[this.getAttribute('preset')] ?? null;
    this._track('--_cols', this.getAttribute('cols') ?? preset?.cols);
    this._track('--_rows', this.getAttribute('rows') ?? preset?.rows);
    this._prop(this._grid, '--_gap', this.getAttribute('gap'));
    this._slot.assignedElements().forEach((el, i) => {
      const area = el.getAttribute('area');
      const span = el.getAttribute('span');
      const rows = el.getAttribute('rows');
      // Precedence: any explicit child attr beats the preset's slot for
      // this index; slotless / attr-less children auto-flow.
      const slotArea = (area === null && span === null && rows === null)
        ? preset?.slots?.[i] ?? null : null;
      this._prop(el, '--_ba', area ?? slotArea);
      this._prop(el, '--_bc', span);
      this._prop(el, '--_br', rows);
    });
  }

  /** Integer count → equal minmax(0,1fr) tracks; anything else is a literal track list. */
  _track(name, v) {
    if (v == null || String(v).trim() === '') { this._grid.style.removeProperty(name); return; }
    const n = Number(v);
    const tracks = Number.isInteger(n) && n > 0 ? `repeat(${n}, minmax(0, 1fr))` : String(v);
    this._grid.style.setProperty(name, tracks);
  }

  _prop(el, name, val) {
    if (val == null || val === '') el.style.removeProperty(name);
    else el.style.setProperty(name, val);
  }

  _applyCollapse() {
    if (this.getAttribute('collapse') === 'none') {
      this.removeAttribute('data-collapsed');
      return;
    }
    // Number(null) → 0 → falls to the 640 default on purpose (absent-attr trap).
    const t = Number(this.getAttribute('collapse'));
    const threshold = Number.isFinite(t) && t > 0 ? t : 640;
    const w = this._lastWidth ?? this.getBoundingClientRect().width;
    // w > 0 guard: display:none containers report 0 — don't collapse them.
    const next = w > 0 && w < threshold;
    // State-change guard (no attribute churn → no RO feedback loop).
    if (next !== this.hasAttribute('data-collapsed')) {
      this.toggleAttribute('data-collapsed', next);
    }
  }
}

customElements.define('ax-bento', AxBento);
