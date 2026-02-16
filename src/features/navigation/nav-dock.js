import { BaseComponent } from '@shared/base-component.js';
import { router } from '@core/router.js';
import { state } from '@state';
import { auth } from '@core/auth.js';

export class NavDock extends BaseComponent {
  async connectedCallback() {
    await this.addExternalStyles(new URL('./navigation.css', import.meta.url).href);
    super.connectedCallback();

    // Subscribe to route changes to update active state
    this._cleanup = state.subscribe(({ key, value }) => {
      if (key === 'route') {
        this.updateActive(value);
      }
      if (key === 'user' || key === 'theme') {
        this.render();
      }
      if (key === 'audioLevel') {
        const slider = this.shadowRoot.querySelector('.audio-slider');
        if (slider) slider.value = value;
      }
      if (key === 'captionsEnabled') {
        const cb = this.shadowRoot.querySelector('.captions-checkbox');
        if (cb) cb.checked = value;
      }
    });

    // Set initial active state
    this.updateActive(state.data.route);

    // Bridge the Shadow DOM gap to the global router (One-time setup)
    this.shadowRoot.addEventListener('click', e => {
      // Handle Settings Button
      if (e.target.closest('.settings-btn')) {
        e.preventDefault();
        e.stopPropagation();
        const menu = this.shadowRoot.querySelector('.settings-menu');
        if (menu) menu.classList.toggle('hidden');
        return;
      }
      // Clicks inside settings menu shouldn't close it
      if (e.target.closest('.settings-menu')) {
        return;
      }
      // Close settings menu on click outside
      const menu = this.shadowRoot.querySelector('.settings-menu');
      if (menu && !menu.classList.contains('hidden')) {
        menu.classList.add('hidden');
      }
      const link = e.target.closest('a');
      if (link) {
        const href = link.getAttribute('href');
        if (href === state.data.route) {
          e.preventDefault();
          return;
        }
      }
      router.handleIntercept(e);
    });

    // Settings menu input handlers (delegated, survives re-renders)
    this.shadowRoot.addEventListener('input', e => {
      if (e.target.closest('.audio-slider')) {
        state.data.audioLevel = parseInt(e.target.value, 10);
      }
    });
    this.shadowRoot.addEventListener('change', e => {
      if (e.target.closest('.captions-checkbox')) {
        state.data.captionsEnabled = e.target.checked;
      }
      if (e.target.closest('.theme-checkbox')) {
        state.data.theme = e.target.checked ? 'dark' : 'light';
      }
    });
  }

  disconnectedCallback() {
    if (this._cleanup) this._cleanup();
  }

  render() {
    const isAuthenticated = auth.isAuthenticated();
    const user = auth.getUser();
    const isDark = state.data.theme === 'dark';

    this.shadowRoot.innerHTML = `
    <nav class="dock-wrapper">
      <a class="nav-link" href="home" title="Home" aria-label="Home">
        <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      </a>
      <a class="nav-link" href="dashboard" title="Dashboard" aria-label="Dashboard">
        <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="7" height="9" x="3" y="3" rx="1"></rect>
          <rect width="7" height="5" x="14" y="3" rx="1"></rect>
          <rect width="7" height="9" x="14" y="12" rx="1"></rect>
          <rect width="7" height="5" x="3" y="16" rx="1"></rect>
        </svg>
      </a>
      <a class="nav-link" href="contact" title="Contact" aria-label="Contact">
        <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="20" height="16" x="2" y="4" rx="2"></rect>
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
        </svg>
      </a>
      
      ${isAuthenticated ? `
        <a class="nav-link profile-link" href="profile" title="${user?.email || 'Profile'}" aria-label="Profile">
          ${user?.picture ? `
            <img class="avatar-img" src="${user.picture}" alt="Profile" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <svg class="icon fallback-avatar" style="display:none;" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          ` : `
            <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          `}
        </a>
      ` : `
        <a class="nav-link login-link" href="login" title="Login" aria-label="Login">
          <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
            <polyline points="10 17 15 12 10 7"></polyline>
            <line x1="15" y1="12" x2="3" y2="12"></line>
          </svg>
        </a>
      `}

      <button class="nav-link settings-btn" aria-label="Settings" aria-haspopup="true">
        <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>

      <div class="settings-menu hidden" role="menu" aria-label="Settings">
        <div class="settings-row" role="menuitem" title="Appearance">
          <svg class="settings-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${isDark ? `
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            ` : `
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            `}
          </svg>
          <label class="toggle-switch" aria-label="Toggle dark mode">
            <input type="checkbox" class="toggle-input theme-checkbox" ${isDark ? 'checked' : ''}>
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row" role="menuitem" title="Audio">
          <svg class="settings-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
          </svg>
          <input type="range" class="audio-slider" aria-label="Audio level" min="0" max="100" value="${state.data.audioLevel}">
        </div>
        <div class="settings-row" role="menuitem" title="Closed Captions">
          <svg class="settings-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"></rect>
            <text x="6" y="15" font-size="9" font-weight="700" fill="currentColor" stroke="none" font-family="sans-serif">CC</text>
          </svg>
          <label class="toggle-switch" aria-label="Toggle captions">
            <input type="checkbox" class="toggle-input captions-checkbox" ${state.data.captionsEnabled ? 'checked' : ''}>
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
          </label>
        </div>
      </div>
    </nav>
  `;

    // Ensure initial active state is set after render
    this.updateActive(state.data.route);
  }


  updateActive(route) {
    this.shadowRoot.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href');
      // Simple match: href 'home' matches route 'home'
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

customElements.define('nav-dock', NavDock);
