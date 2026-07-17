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
      // offset* metrics ignore transforms — measure final layout, not the
      // mid-entrance animated geometry.
      const parent = this.offsetParent;
      const parentTop = parent ? parent.getBoundingClientRect().top : 0;
      if (parentTop + this.offsetTop < 8) this.dataset.placement = 'below';
      // Move focus into the panel only on keyboard-driven opens — pointer
      // users keep focus on the invoker (ARIA menu pattern), no stray ring.
      if (this._invoker && !this._invoker.matches(':focus-visible')) return;
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
    if (this.open) this.hide();
    document.removeEventListener('pointerdown', this._onDocPointerDown, true);
    document.removeEventListener('keydown', this._onDocKeydown, true);
  }
}

customElements.define('ax-popover', AxPopover);
