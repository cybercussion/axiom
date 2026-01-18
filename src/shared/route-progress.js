import { BaseComponent } from './base-component.js';
import { state } from '@state';

class RouteProgress extends BaseComponent {
  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          width: 100vw;
          height: 3px;
          margin: 0;
          padding: 0;
          z-index: 10000; /* Increment to stay above EVERYTHING */
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s ease;
          overflow: hidden;
          line-height: 0; /* Kill any mysterious inline-block whitespace */
        }

        :host([active]) {
          opacity: 1;
        }

        .bar {
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, 
            #ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ec4899, #ef4444);
          background-size: 200% 100%;
          animation: spectrum 1.5s linear infinite;
          transform: translateX(-100%);
          transition: transform 0.2s ease-out;
        }

        :host([active]) .bar {
          /* JS Engine takes the wheel */
        }

        @keyframes spectrum {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      </style>
      <div class="bar"></div>
    `;

    this._timer = null;

    this._unsub = state.subscribe(({ key, value }) => {
      if (key === 'transitioning') {
        if (value) {
          this.show();
        } else {
          this.hide();
        }
      }
    });
  }

  show() {
    clearTimeout(this._timer);
    const bar = this.shadowRoot.querySelector('.bar');

    // 1. Hard Reset: Snap to start immediately
    bar.style.transition = 'none';
    bar.style.transform = 'translateX(-100%)';

    // Force Reflow
    void bar.offsetWidth;

    this.setAttribute('active', '');

    // 2. Initial Jump: Use a sharper bezier for that "kickstart" feel
    bar.style.transition = 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)';
    bar.style.transform = 'translateX(-70%)';

    // 3. The "Infinite" Crawl: A very long transition to mimic loading
    this._timer = setTimeout(() => {
      bar.style.transition = 'transform 10s cubic-bezier(0, 0.5, 0.5, 1)';
      bar.style.transform = 'translateX(-5%)';
    }, 400);
  }

  hide() {
    const bar = this.shadowRoot.querySelector('.bar');
    clearTimeout(this._timer);

    // 4. Final Snap: Quick move to 100%
    bar.style.transition = 'transform 0.3s ease-out';
    bar.style.transform = 'translateX(0%)';

    this._timer = setTimeout(() => {
      this.removeAttribute('active');
    }, 300);
  }

  disconnectedCallback() {
    if (this._unsub) this._unsub();
  }
}

customElements.define('route-progress', RouteProgress);
