import { BaseComponent } from '@shared/base-component.js';
import { router } from '@core/router.js';
import { state } from '@state';
import { auth } from '@core/auth.js';
import '@shared/controls/ax-popover.js';
import '@shared/controls/ax-toggle.js';
import '@shared/controls/ax-slider.js';

export class NavDock extends BaseComponent {
  async connectedCallback() {
    await this.addExternalStyles(new URL('./navigation.css', import.meta.url).href);
    super.connectedCallback();

    // Subscribe to route changes to update active state
    this._cleanup = state.subscribe(({ key, value }) => {
      if (key === 'route') this.updateActive(value);
      if (key === 'user') this.render();
      if (key === 'theme') this._syncThemeIcon(value);
      if (key === 'audioLevel') {
        const slider = this.shadowRoot.querySelector('.audio-slider');
        if (slider) slider.value = value;
      }
      if (key === 'captionsEnabled') {
        const t = this.shadowRoot.querySelector('.captions-toggle');
        if (t) t.checked = value;
      }
    });

    // Set initial active state
    this.updateActive(state.data.route);

    // Bridge the Shadow DOM gap to the global router (One-time setup)
    this.shadowRoot.addEventListener('click', e => {
      if (e.target.closest('.settings-btn')) {
        e.preventDefault();
        e.stopPropagation();
        const pop = this.shadowRoot.querySelector('ax-popover');
        pop?.toggle(this.shadowRoot.querySelector('.settings-btn'));
        return;
      }
      if (e.composedPath().some(el => el.tagName === 'AX-POPOVER')) return;
      const link = e.target.closest('a');
      if (link && link.getAttribute('href') === state.data.route) {
        e.preventDefault();
        return;
      }
      router.handleIntercept(e);
    });

    // Settings menu input handlers (delegated, survives re-renders)
    this.shadowRoot.addEventListener('input', e => {
      if (e.target.classList?.contains('audio-slider')) {
        state.data.audioLevel = e.detail.value;
      }
    });
    this.shadowRoot.addEventListener('change', e => {
      if (e.target.classList?.contains('captions-toggle')) {
        state.data.captionsEnabled = e.detail.checked;
      }
      if (e.target.classList?.contains('theme-toggle')) {
        state.data.theme = e.detail.checked ? 'dark' : 'light';
      }
    });

    this._onResize = () => this._positionPill(false);
    window.addEventListener('resize', this._onResize);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._cleanup) this._cleanup();
    window.removeEventListener('resize', this._onResize);
  }

  render() {
    const isAuthenticated = auth.isAuthenticated();
    const user = auth.getUser();
    const isDark = state.data.theme === 'dark';

    this.shadowRoot.innerHTML = `
    <nav class="dock-wrapper">
      <span class="dock-pill" aria-hidden="true"></span>
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
      <a class="nav-link" href="components" title="Components" aria-label="Components">
        <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2"></rect>
          <path d="M3 9h18"></path><path d="M9 21V9"></path>
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

      <ax-popover aria-label="Settings">
        <div class="settings-row" title="Appearance">
          <svg class="settings-icon theme-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${this._themeIconPath(isDark)}</svg>
          <ax-toggle class="theme-toggle" label="Toggle dark mode" ${isDark ? 'checked' : ''}></ax-toggle>
        </div>
        <div class="settings-row" title="Audio">
          <ax-slider class="audio-slider" variant="fill" label="Audio level" min="0" max="100" value="${state.data.audioLevel}">
            <svg slot="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            </svg>
          </ax-slider>
        </div>
        <div class="settings-row" title="Closed Captions">
          <svg class="settings-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"></rect>
            <text x="6" y="15" font-size="9" font-weight="700" fill="currentColor" stroke="none" font-family="sans-serif">CC</text>
          </svg>
          <ax-toggle class="captions-toggle" label="Toggle captions" ${state.data.captionsEnabled ? 'checked' : ''}></ax-toggle>
        </div>
      </ax-popover>
    </nav>
  `;

    // Ensure initial active state is set after render
    this.updateActive(state.data.route);
    this._positionPill(false);
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
    this._positionPill(true);
  }

  _themeIconPath(isDark) {
    return isDark
      ? `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`
      : `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
  }

  _syncThemeIcon(theme) {
    const icon = this.shadowRoot.querySelector('.theme-icon');
    if (icon) icon.innerHTML = this._themeIconPath(theme === 'dark');
    const t = this.shadowRoot.querySelector('.theme-toggle');
    if (t) t.checked = theme === 'dark';
  }

  /**
   * Springy indicator: measure the active link and glide the pill to it.
   * animate=false snaps (initial paint, resize) — no transition flash.
   */
  _positionPill(animate = true) {
    const pill = this.shadowRoot.querySelector('.dock-pill');
    const wrapper = this.shadowRoot.querySelector('.dock-wrapper');
    const active = this.shadowRoot.querySelector('.nav-link.active');
    if (!pill || !wrapper) return;
    if (!active) { pill.style.opacity = '0'; return; }
    const w = wrapper.getBoundingClientRect();
    const r = active.getBoundingClientRect();
    if (!animate) pill.style.transition = 'none';
    pill.style.opacity = '1';
    pill.style.width = `${r.width}px`;
    pill.style.height = `${r.height}px`;
    pill.style.transform = `translate(${r.left - w.left}px, ${r.top - w.top}px)`;
    if (!animate) requestAnimationFrame(() => { pill.style.transition = ''; });
  }

}

customElements.define('nav-dock', NavDock);
