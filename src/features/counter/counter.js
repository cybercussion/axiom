import { BaseComponent } from '@shared/base-component.js';
import { state } from '@state';

class CounterUI extends BaseComponent {
  async connectedCallback() {
    // 1. Load styles dynamically
    const cssPath = import.meta.url.replace('.js', '.css');
    await this.addExternalStyles(cssPath);

    // 2. Initialize global state if missing
    if (state.data.count === undefined) {
      state.data.count = 0;
    }

    // Pre-load API to prevent stutter on first click
    this.api = await import('./counter-api.js');

    // 3. Render initial HTML
    super.connectedCallback();

    // 4. Subscribe to state changes using the Proxy's event bus
    // We return the cleanup function to be called on disconnect (if we implemented it)
    this._cleanup = state.subscribe(({ key, value }) => {
      if (key === 'count') {
        this.updateCount(value);
      }
    });

    // 5. Hydrate current state
    this.updateCount(state.data.count);
  }

  disconnectedCallback() {
    if (this._cleanup) this._cleanup();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <div class="counter-container">
        <!-- Semantic Slot: Light DOM content for accessibility -->
        <slot name="title"><h1>Global Counter</h1></slot>
        
        <div class="count-display">--</div>
        <div class="controls">
          <button id="dec" class="btn btn-secondary btn-fill" aria-label="Decrement">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <button id="inc" class="btn btn-primary btn-fill" aria-label="Increment">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Event Delegation / Binding
    // Use state.mutate for optimistic updates
    this.shadowRoot.querySelector('#inc').onclick = () => {
      const current = state.data.count;
      const val = (typeof current === 'object' && 'data' in current) ? current.data : current;
      const next = (val || 0) + 1;

      state.mutate('count', next, () => this.api.saveCount(next));
    };

    this.shadowRoot.querySelector('#dec').onclick = () => {
      const current = state.data.count;
      const val = (typeof current === 'object' && 'data' in current) ? current.data : current;
      const next = (val || 0) - 1;

      state.mutate('count', next, () => this.api.saveCount(next));
    };

    // Cache the display element for surgical updates
    this.ref('display', '.count-display');
  }

  updateCount(value) {
    const el = this.ref('display');
    if (el) {
      // Handle both primitive (0) and smart object ({ data: 0, ... })
      let displayVal = value;
      if (value && typeof value === 'object' && 'data' in value) {
        displayVal = value.data;
      }

      el.textContent = displayVal;
      // Optional: Visual flair based on value
      el.style.color = displayVal < 0 ? 'var(--color-primary)' : 'var(--color-foreground)';
    }
  }
}

customElements.define('counter-ui', CounterUI);
