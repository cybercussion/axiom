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

    // Define handlers once per instance (moved from render per house rule)
    this._handleClick = e => {
      const nav = e.target.closest?.('.nav');
      if (nav) {
        const anchor = parse(this.getAttribute('date') || iso(new Date()));
        anchor.setDate(anchor.getDate() + Number(nav.dataset.shift));
        this.setAttribute('date', iso(anchor));
        return;
      }
      const day = e.target.closest?.('.day');
      if (day) this._select(day.dataset.date);
    };

    this._handleKeydown = e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const d = parse(this.selected || this.getAttribute('date') || iso(new Date()));
      d.setDate(d.getDate() + (e.key === 'ArrowRight' ? 1 : -1));
      // Batch the week shift + selection into ONE rebuild, then restore focus —
      // _sync destroys the day buttons, which would otherwise drop keyboard focus
      // to <body> and make arrow navigation single-shot.
      this._suppressSync = true;
      this.setAttribute('date', iso(d));
      this._suppressSync = false;
      this._select(iso(d));
      this.shadowRoot.querySelector('[aria-current="date"]')?.focus();
      e.preventDefault();
    };
  }

  connectedCallback() {
    super.connectedCallback();
    // Pill position is pixel-cached; re-measure on viewport changes
    // (parity with nav-dock's dock pill).
    this._onResize = () => this._positionPill(false);
    window.addEventListener('resize', this._onResize);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('resize', this._onResize);
  }

  get selected() { return this.getAttribute('selected') || ''; }
  set selected(v) { this.setAttribute('selected', v); }

  attributeChangedCallback() {
    if (this._suppressSync) return;
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

    // Attach handlers defined in constructor
    this.shadowRoot.addEventListener('click', this._handleClick);
    this.shadowRoot.addEventListener('keydown', this._handleKeydown);

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
