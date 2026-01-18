import { BaseComponent } from '@shared/base-component.js';
import { router } from '@core/router.js';

class NotFoundUI extends BaseComponent {
  async setup() {
    const cssPath = new URL('./not-found.css', import.meta.url).href;
    await this.addExternalStyles(cssPath);
  }

  render() {
    this.shadowRoot.innerHTML = `
      <div class="starfield">
        <div class="stars stars-1"></div>
        <div class="stars stars-2"></div>
        <div class="stars stars-3"></div>
      </div>
      <div class="void-container">
        <h1 class="glitch" data-text="404">404</h1>
        <div class="message">
          <h2>Page Not Found</h2>
          <p>You've ventured a bit too far into the unknown.</p>
          <p class="snark">We searched the entire galaxy, but this page seems to be lost in space.</p>
        </div>
        <button class="btn btn-primary btn-outline" id="home-btn">Escape to Safety</button>
      </div>
    `;

    this.shadowRoot.getElementById('home-btn').onclick = () => router.navigate('/home');
  }
}

customElements.define('not-found-ui', NotFoundUI);
