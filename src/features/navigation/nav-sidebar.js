import { BaseComponent } from '@shared/base-component.js';
import { router } from '@core/router.js';
import { state } from '@state';

export class NavSidebar extends BaseComponent {
  async connectedCallback() {
    this.addExternalStyles(new URL('./navigation.css', import.meta.url).href);
    super.connectedCallback();

    // Subscribe to route changes
    this._cleanup = state.subscribe(({ key, value }) => {
      if (key === 'route') {
        this.updateActive(value);
      }
    });

    this.updateActive(state.data.route);
  }

  disconnectedCallback() {
    if (this._cleanup) this._cleanup();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <h3>Axiom</h3>
      <a class="nav-link" href="home">Home</a>
      <a class="nav-link" href="counter">Counter</a>
      <a class="nav-link" href="dashboard">Dashboard</a>
      <a class="nav-link" href="contact">Contact</a>
    `;

    this.shadowRoot.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        router.navigate(link.getAttribute('href'));
      });
    });
  }

  updateActive(route) {
    this.shadowRoot.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href === route) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }
}

customElements.define('nav-sidebar', NavSidebar);
