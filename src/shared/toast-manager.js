import { BaseComponent } from './base-component.js';
import { state } from '@state';

class ToastManager extends BaseComponent {
  constructor() {
    super();
    this._activeToasts = new Map();
  }

  async setup() {
    const cssPath = new URL('./styles/toast.css', import.meta.url).href;
    await this.addExternalStyles(cssPath);

    this.subscribe('notifications', (list) => {
      this.render(list || []);
    });
  }

  connectedCallback() {
    super.connectedCallback();
  }

  createToastElement(note) {
    const el = document.createElement('div');
    el.className = `toast ${note.type}`;
    el.dataset.id = note.id;
    el.innerHTML = `
      <span class="message">${note.message}</span>
      <button class="close-btn" aria-label="Close">&times;</button>
    `;

    // Manual Close
    el.querySelector('.close-btn').onclick = () => state.dismissToast(note.id);
    return el;
  }

  render(notifications) {
    // Fallback if called without args
    if (!notifications) notifications = state.get('notifications') || [];

    // Ensure container
    let container = this.shadowRoot.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      this.shadowRoot.appendChild(container);
    }

    // 1. Reconciliation: Remove Stale
    const newIds = new Set(notifications.map(n => n.id));

    for (const [id, el] of this._activeToasts.entries()) {
      if (!newIds.has(id)) {
        // Flag it in the Map immediately so 'render' stops caring about it
        this._activeToasts.delete(id);

        // Trigger the CSS-driven exit
        el.classList.add('exiting');

        // Pure DOM cleanup
        el.addEventListener('animationend', () => {
          el.remove();
        }, { once: true }); // Crucial: prevents listener stacking
      }
    }

    // 2. Reconciliation: Add New
    notifications.forEach(note => {
      if (!this._activeToasts.has(note.id)) {
        const el = this.createToastElement(note);
        this._activeToasts.set(note.id, el);
        container.appendChild(el);
      }
    });
  }
}

customElements.define('toast-manager', ToastManager);
