/**
 * /login — the template's sign-in page.
 *
 * Reconciled from tender's login (Google, with an optional Turnstile check),
 * without tender's branding. Sign-in goes through src/core/auth.js, which is a
 * PLACEHOLDER integration: the button appears only when axiom-config.js
 * configures a provider. With none configured the page says so, rather than
 * offering a button that cannot work.
 */
import { BaseComponent } from '@shared/base-component.js';
import { auth } from '@core/auth.js';
import { config } from '@core/config.js';
import { router } from '@core/router.js';

const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const TURNSTILE_STORAGE_KEY = 'turnstile_auth_token';

class LoginUI extends BaseComponent {
  async setup() {
    await this.addExternalStyles(new URL('./login.css', import.meta.url).href);
    // Already signed in? There is nothing to do here.
    if (auth.isAuthenticated()) router.navigate('/home', true);
    this.subscribe('user', (user) => { if (user) router.navigate('/home', true); });
  }

  render() {
    const { GOOGLE_CLIENT_ID, USER_POOL_DOMAIN } = config.AUTH || {};
    const configured = Boolean(GOOGLE_CLIENT_ID || USER_POOL_DOMAIN);
    this.shadowRoot.innerHTML = `
      <section class="login-stage">
        <div class="glass-card login-card">
          <h1 class="login-title">Sign in</h1>
          ${configured ? `
            <div class="login-turnstile" data-ref="turnstile" hidden></div>
            <button class="btn btn-primary btn-fill login-google" data-ref="google" type="button">Continue with Google</button>
            <p class="login-note">No passwords here — your identity provider handles that.</p>
          ` : `
            <p class="login-note" role="status">Sign-in isn't configured for this deployment.</p>
            <p class="login-hint">Axiom's auth is a placeholder. Set <code>AUTH</code> in <code>axiom-config.js</code>, or replace <code>src/core/auth.js</code> with the sign-in your application uses — see <code>docs/auth-readme.md</code>.</p>
          `}
        </div>
      </section>
    `;
  }

  onRendered() {
    const button = this.ref('google', '[data-ref="google"]');
    if (!button) return;
    if (config.TURNSTILE_SITE_KEY) this._initTurnstile();
    button.addEventListener('click', async () => {
      button.disabled = true;
      const { USER_POOL_DOMAIN } = config.AUTH || {};
      try { await auth.loginWith(USER_POOL_DOMAIN ? 'Google' : 'DirectGoogle'); }
      finally { button.disabled = false; }
    });
  }

  /** Optional bot check before the OAuth redirect; auth.js threads the token into the code exchange. */
  _initTurnstile() {
    const wrap = this.ref('turnstile', '[data-ref="turnstile"]');
    wrap.hidden = false;
    sessionStorage.removeItem(TURNSTILE_STORAGE_KEY);
    if (!document.getElementById('turnstile-script')) {
      const script = document.createElement('script');
      script.id = 'turnstile-script';
      script.src = `${TURNSTILE_SCRIPT}?render=explicit`;
      script.async = true;
      document.head.appendChild(script);
    }
    // Wait for the API — but not forever. A blocked script (a CSP without the
    // Turnstile origin, an ad blocker) must not poll for the life of the page.
    let tries = 50;
    const tryRender = () => {
      if (typeof window.turnstile === 'undefined') {
        if (--tries > 0) setTimeout(tryRender, 100);
        return;
      }
      window.turnstile.render(wrap, {
        sitekey: config.TURNSTILE_SITE_KEY,
        theme: 'dark',
        action: 'auth',
        callback: (token) => sessionStorage.setItem(TURNSTILE_STORAGE_KEY, token),
        'expired-callback': () => sessionStorage.removeItem(TURNSTILE_STORAGE_KEY),
        'error-callback': () => sessionStorage.removeItem(TURNSTILE_STORAGE_KEY),
      });
    };
    tryRender();
  }
}

customElements.define('login-ui', LoginUI);
