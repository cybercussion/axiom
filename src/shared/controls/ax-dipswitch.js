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
