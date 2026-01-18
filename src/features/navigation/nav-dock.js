import { BaseComponent } from '@shared/base-component.js';
import { router } from '@core/router.js';
import { state } from '@state';

export class NavDock extends BaseComponent {
  async connectedCallback() {
    this.addExternalStyles(new URL('./navigation.css', import.meta.url).href);
    super.connectedCallback();

    // Subscribe to route changes to update active state
    this._cleanup = state.subscribe(({ key, value }) => {
      if (key === 'route') {
        this.updateActive(value);
      }
    });

    // Set initial active state
    this.updateActive(state.data.route);
  }

  disconnectedCallback() {
    if (this._cleanup) this._cleanup();
  }

  render() {
    this.shadowRoot.innerHTML = `
    <nav class="dock-wrapper">
      <a class="nav-link" href="home">Home</a>
      <a class="nav-link" href="counter">Counter</a>
      <a class="nav-link" href="dashboard">Dashboard</a>
      <a class="nav-link" href="contact">Contact</a>
      <button class="nav-link theme-toggle" aria-label="Toggle Theme">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      </button>
    </nav>
  `;

    // Bridge the Shadow DOM gap to the global router
    this.shadowRoot.addEventListener('click', e => {
      const btn = e.target.closest('.theme-toggle');
      if (btn) {
        this.toggleTheme();
        return;
      }

      const link = e.target.closest('a');
      if (link) {
        const href = link.getAttribute('href');
        // If we're already on this route, do nothing
        if (href === state.data.route) {
          e.preventDefault();
          return;
        }
      }

      router.handleIntercept(e);
    });
  }

  updateActive(route) {
    this.shadowRoot.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href');
      // Simple match: href 'home' matches route 'home'
      if (href === route) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  toggleTheme() {
    const next = state.data.theme === 'light' ? 'dark' : 'light';
    state.data.theme = next;
  }
}

customElements.define('nav-dock', NavDock);
