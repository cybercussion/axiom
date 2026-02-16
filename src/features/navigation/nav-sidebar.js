import { BaseComponent } from '@shared/base-component.js';
import { router } from '@core/router.js';
import { state } from '@state';
import { auth } from '@core/auth.js';

export class NavSidebar extends BaseComponent {
  async connectedCallback() {
    await this.addExternalStyles(new URL('./navigation.css', import.meta.url).href);
    super.connectedCallback();

    // Subscribe to route changes
    this._cleanup = state.subscribe(({ key, value }) => {
      if (key === 'route') {
        this.updateActive(value);
      }
      if (key === 'user') {
        this.render();
      }
    });

    this.updateActive(state.data.route);
  }

  disconnectedCallback() {
    if (this._cleanup) this._cleanup();
  }

  render() {
    const isAuthenticated = auth.isAuthenticated();
    const user = auth.getUser();

    this.shadowRoot.innerHTML = `
      <h3>Axiom</h3>
      <nav aria-label="Sidebar Navigation">
        <a class="nav-link" href="home">
          <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span>Home</span>
        </a>
        <a class="nav-link" href="dashboard">
          <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="7" height="9" x="3" y="3" rx="1"></rect>
            <rect width="7" height="5" x="14" y="3" rx="1"></rect>
            <rect width="7" height="9" x="14" y="12" rx="1"></rect>
            <rect width="7" height="5" x="3" y="16" rx="1"></rect>
          </svg>
          <span>Dashboard</span>
        </a>
        <a class="nav-link" href="contact">
          <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="20" height="16" x="2" y="4" rx="2"></rect>
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
          </svg>
          <span>Contact</span>
        </a>
        ${isAuthenticated ? `
          <a class="nav-link profile-link" href="profile">
             ${user?.picture ? `
               <img class="avatar-img" src="${user.picture}" alt="Profile">
             ` : `
               <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                 <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                 <circle cx="12" cy="7" r="4"></circle>
               </svg>
             `}
             <span>Profile</span>
          </a>
        ` : `
          <a class="nav-link login-link" href="login">
            <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
              <polyline points="10 17 15 12 10 7"></polyline>
              <line x1="15" y1="12" x2="3" y2="12"></line>
            </svg>
            <span>Login</span>
          </a>
        `}
      </nav>
    `;

    this.updateActive(state.data.route);

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
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    });
  }
}

customElements.define('nav-sidebar', NavSidebar);
