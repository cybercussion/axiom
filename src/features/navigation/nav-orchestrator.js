import { BaseComponent } from '@shared/base-component.js';
import { state } from '@state';
import { config } from '@core/config.js';

class NavOrchestrator extends BaseComponent {
  connectedCallback() {
    // No shadow DOM needed for the orchestrator itself, 
    // it just manages the slot content.
    // Or we can use shadow for clean slotting.
    // Let's use light DOM manipulation on itself since it IS the container.
    // Actually, BaseComponent attaches ShadowDOM. Let's use it to host the nav.
    super.connectedCallback();

    // CRITICAL: BaseComponent sets 'contain: content' which traps fixed-position children.
    this.addStyles(':host { contain: none; }');

    this._cleanup = state.subscribe(({ key, value }) => {
      if (key === 'navStyle') {
        this.switchNav(value);
      }
    });

    const initialStyle = state.data.navStyle || config.NAV_STYLE;
    this.switchNav(initialStyle);
  }

  disconnectedCallback() {
    if (this._cleanup) this._cleanup();
  }

  async switchNav(style) {
    const tagName = `nav-${style}`;

    try {
      await import(`./nav-${style}.js`);
    } catch (e) {
      console.error(`Failed to load nav style: ${style}`, e);
      return;
    }

    // REMOVED startViewTransition here to prevent the AbortError conflict
    this.updateDOM(tagName);
  }

  updateDOM(tagName) {
    // Check if already correct
    const current = this.shadowRoot.firstElementChild;
    if (current?.tagName.toLowerCase() === tagName) return;

    this.shadowRoot.innerHTML = `<${tagName}></${tagName}>`;
    this._observeNav(this.shadowRoot.firstElementChild);
  }

  _observeNav(target) {
    if (this._resizeObserver) this._resizeObserver.disconnect();

    this._resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { height, width } = entry.contentRect;
        const rect = entry.target.getBoundingClientRect();
        const root = document.documentElement;

        // Heuristic: If it's at the bottom (Dock), pad bottom.
        // If it's at the left (Sidebar), pad left.

        // Check for Dock-like positioning (bottom < window height)
        const isDock = rect.top > window.innerHeight / 2;

        if (isDock) {
          // Bottom Padding = Element Height + Bottom Offset (from CSS)
          // We can estimate offset by checking window - rect.bottom
          const bottomOffset = window.innerHeight - rect.bottom;
          const totalPad = Math.round(rect.height + bottomOffset + 24); // +24px breathing room

          root.style.setProperty('--nav-bottom-pad', `${totalPad}px`);
          root.style.setProperty('--nav-left-pad', '0px');
        } else {
          // Sidebar logic (Left aligned)
          root.style.setProperty('--nav-bottom-pad', '0px');
          root.style.setProperty('--nav-left-pad', `${Math.round(rect.width)}px`);
        }
      }
    });

    this._resizeObserver.observe(target);
  }
}

customElements.define('nav-orchestrator', NavOrchestrator);
