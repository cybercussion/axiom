import { BaseComponent } from '@shared/base-component.js';
import '@shared/modal.js';

class HomeUI extends BaseComponent {
  async setup() {
    const cssPath = import.meta.url.replace('.js', '.css');
    await this.addExternalStyles(cssPath);
    this.checkWelcome();
  }

  checkWelcome() {
    const hasSeen = localStorage.getItem('axiom-welcome-seen');
    if (!hasSeen) {
      // Duration 0 = Infinite (requires dismissal)
      setTimeout(() => {
        import('@state').then(({ state }) => {
          state.notify('Welcome to Axiom. Nullius in verba.', 'info', 0);
          localStorage.setItem('axiom-welcome-seen', 'true');
        });
      }, 1000); // Slight delay for dramatic effect
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <div class="canvas">
        <div class="blob"></div>
        <section class="hero-card">
          <div class="badge">v1.0.42</div>
          <h1 class="reveal-text">Axiom</h1>
          <p class="reveal-sub">Escape the dependency hell of modern frameworks. Pure performance. Zero noise.</p>
          <div class="actions">
            <!-- Using Global Button System -->
            <button class="btn btn-primary btn-fill" id="init-engine">
              Initialize Engine
            </button>
            <button class="btn btn-secondary btn-ghost">
              System Docs
            </button>
          </div>
        </section>
      </div>
      
      <axiom-modal id="engine-modal" title="Dependency Withdrawal Detected" size="xl">
        <div class="roast-container">
          <p>It appears you're looking for a <strong>Virtual DOM</strong> to hold your hand. How embarrassing.</p>
          
          <p>Axiom has detected that your brain is idling while waiting for a 2MB hydration script that isn't coming. No hooks. No signals. No bloated state reconciliation.</p>
          
          <blockquote class="motto">
            Nullius in verba.
          </blockquote>

          <p class="text-sm muted">Status: 0% Bloat detected. 100% Skill Issue confirmed.</p>
        </div>
        
          <button slot="actions" class="btn btn-success btn-outline" id="confirm-no-engine" autofocus>
            I accept my fate as a real developer
          </button>
          <button slot="actions" class="btn btn-primary btn-fill" onclick="window.location.href='http://vanilla-js.com/'">
            Go back to my safety blanket
          </button>
      </axiom-modal>
    `;

    this.shadowRoot.getElementById('init-engine').onclick = () => {
      this.shadowRoot.getElementById('engine-modal').open();
    };

    this.shadowRoot.getElementById('confirm-no-engine').onclick = () => {
      this.shadowRoot.getElementById('engine-modal').close();
    };
  }
}

customElements.define('home-ui', HomeUI);