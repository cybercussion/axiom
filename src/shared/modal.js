import { BaseComponent } from './base-component.js';

/**
 * AxiomModal
 * A native <dialog> wrapper with glassmorphism, focus trapping, and scroll locking.
 */
export class AxiomModal extends BaseComponent {
  static get observedAttributes() {
    return ['title', 'open', 'size'];
  }

  constructor() {
    super();
    this._title = '';
  }

  setup() {
    // Generate a unique ID for the title to ensuring AOM compliance
    this._titleId = this.bridgeID(null, 'title');
  }

  /**
   * Called primarily by BaseComponent.render()
   */
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: contents;
        }

        /* Size Mapping */
        :host { --modal-width: 500px; } /* Default */
        :host([size="sm"]) { --modal-width: 300px; }
        :host([size="md"]) { --modal-width: 500px; }
        :host([size="lg"]) { --modal-width: 800px; }
        :host([size="xl"]) { --modal-width: 1140px; }
        :host([size="xxl"]) { --modal-width: 95vw; }

        dialog {
          background: var(--modal-bg);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--modal-border);
          border-radius: 16px;
          padding: 0;
          
          /* Dynamic Sizing */
          width: var(--modal-width);
          max-width: 95vw; /* Safety rail for mobile */
          
          color: var(--modal-text);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          
          /* Native dialog override for animation entry */
          opacity: 0;
          transform: translateY(20px) scale(0.95);
          transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        dialog[open] {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        /* Closing State */
        dialog.closing {
          opacity: 0;
          transform: translateY(20px) scale(0.95);
          pointer-events: none; /* Prevent clicks during exit */
        }

        dialog::backdrop {
          background: var(--modal-backdrop);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        dialog[open]::backdrop {
          opacity: 1;
        }

        dialog.closing::backdrop {
          opacity: 0;
        }

        /* Header Area */
        header {
          padding: var(--space-l) var(--space-l) var(--space-xs);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        h2 {
          /* Using theme variable for font size */
          font-size: var(--text-2xl); 
          font-weight: 700;
          color: var(--modal-text);
          /* Remove fixed gradient for better light/dark adaptability */
        }

        /* Close Button (X) */
        .close-btn {
          background: transparent;
          border: none;
          color: var(--color-muted);
          font-size: var(--text-xl);
          cursor: pointer;
          padding: 0.25rem 0.5rem;
          border-radius: 8px;
          line-height: 1;
          transition: all 0.2s ease;
        }

        .close-btn:hover {
          background: rgba(125, 125, 125, 0.1);
          color: var(--modal-text);
        }

        /* Content Area */
        .content {
          padding: var(--space-m) var(--space-l) var(--space-l);
          color: var(--modal-text);
          font-size: var(--text-base);
          opacity: 0.9;
        }

        /* Footer/Actions */
        footer {
          padding: var(--space-m) var(--space-l);
          /* Slight overlay for footer separation */
          background: rgba(125, 125, 125, 0.05);
          display: flex;
          flex-wrap: wrap; /* Handle wrapping on resize */
          justify-content: flex-end;
          align-items: center;
          gap: var(--space-s);
          /* Use theme border */
          border-top: 1px solid var(--modal-border);
        }

        /* Mobile / Compact Mode: Stack buttons */
        @media (max-width: 480px) {
          footer {
            flex-direction: column-reverse; /* Primary action (usually last) moves to top */
            align-items: stretch;
          }

          /* Force slotted buttons to full width */
          ::slotted(*) {
            width: 100%;
            justify-content: center;
          }
        }
      </style>

      <dialog part="dialog" aria-labelledby="${this._titleId}" aria-modal="true">
        <header>
          <h2 id="${this._titleId}">${this.title}</h2>
          <!-- Native close button still works but we intercept the event -->
          <button class="close-btn" aria-label="Close">&times;</button>
        </header>
        
        <div class="content">
          <slot></slot>
        </div>

        <footer>
          <slot name="actions"></slot>
        </footer>
      </dialog>
    `;

    this._dialog = this.shadowRoot.querySelector('dialog');

    // Backdrop click-to-close handler
    this._dialog.addEventListener('click', (e) => {
      if (e.target === this._dialog) {
        this.close();
      }
    });

    // Handle X button manually to ensure animation plays
    this.shadowRoot.querySelector('.close-btn').onclick = (e) => {
      e.stopPropagation();
      this.close();
    };

    // Handle native cancel (Esc key)
    this._dialog.addEventListener('cancel', (e) => {
      e.preventDefault(); // Prevent immediate close
      this.close(); // Run our animated close
    });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'title' && this._dialog) {
      const h2 = this.shadowRoot.getElementById(this._titleId);
      if (h2) h2.textContent = newValue;
      this.title = newValue; // Update Internal property
    }
    // Size is handled via CSS selectors on :host
  }

  get title() {
    return this._title || this.getAttribute('title') || 'Alert';
  }

  set title(val) {
    this._title = val;
    this.setAttribute('title', val);
  }

  get size() {
    return this.getAttribute('size') || 'md';
  }

  set size(val) {
    this.setAttribute('size', val);
  }

  /**
   * Top Layer API: open modal
   */
  open() {
    if (this._dialog && !this._dialog.open) {
      this._dialog.classList.remove('closing');
      this._dialog.showModal();
      document.body.style.overflow = 'hidden'; // Scroll lock
      this.setAttribute('open', '');
    }
  }

  /**
   * Close modal with animation
   */
  close() {
    if (this._dialog && this._dialog.open && !this._isClosing) {
      this._isClosing = true;
      this._dialog.classList.add('closing');

      // Wait for animation to finish
      const cleanup = () => {
        this._dialog.close(); // Triggers 'close' event implicitly, but we handle state cleanup here too
        this._dialog.classList.remove('closing');
        this._isClosing = false;
        this._onClose();
      };

      // Match CSS transition duration (0.3s)
      setTimeout(cleanup, 300);
    }
  }

  /**
   * Internal cleanup
   */
  _onClose() {
    document.body.style.overflow = ''; // Unlock scroll
    this.removeAttribute('open');
    this.dispatchEvent(new CustomEvent('close'));
  }

  disconnectedCallback() {
    // Ensure scroll lock is removed if component is destroyed while open
    document.body.style.overflow = '';
    super.disconnectedCallback();
  }
}

customElements.define('axiom-modal', AxiomModal);
