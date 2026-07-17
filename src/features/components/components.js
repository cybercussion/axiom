/**
 * <components-ui> — living showcase of the Axiom motion system + ax-* controls.
 * Fleet reference page: every control live, tokens visualized, transitions linked.
 */
import { BaseComponent } from '@shared/base-component.js';
import '@shared/controls/ax-toggle.js';
import '@shared/controls/ax-dipswitch.js';
import '@shared/controls/ax-slider.js';
import '@shared/controls/ax-progress.js';
import '@shared/controls/ax-button.js';
import '@shared/controls/ax-popover.js';
import '@shared/controls/ax-skeleton.js';

const DURATIONS = ['instant', 'fast', 'base', 'slow'];
const EASINGS = ['ease-spring', 'ease-spring-gentle', 'ease-out-soft', 'ease-cinematic'];

export class ComponentsUI extends BaseComponent {
  async connectedCallback() {
    await this.addExternalStyles(new URL('./components.css', import.meta.url).href);
    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Preview is page-scoped — don't leave the whole app in reduced motion.
    delete document.documentElement.dataset.motion;
  }

  render() {
    this.shadowRoot.innerHTML = `
      <main class="page">
        <h1>Components &amp; Motion</h1>
        <p class="motto">Hard rule: no fast default vanilla behavior. Everything animates.</p>

        <section class="glass-card">
          <h2>Reduced motion</h2>
          <div class="row">
            <ax-toggle class="rm-toggle" label="Preview reduced motion"
              ${document.documentElement.dataset.motion === 'reduced' ? 'checked' : ''}></ax-toggle>
            <span>Preview <code>prefers-reduced-motion</code> — collapses every token to 1ms.</span>
          </div>
        </section>

        <section class="glass-card">
          <h2>Buttons</h2>
          <div class="row">
            <ax-button class="load-demo">Fill (click = loading)</ax-button>
            <ax-button variant="outline" tone="secondary">Outline</ax-button>
            <ax-button variant="ghost">Ghost</ax-button>
            <ax-button tone="danger">Danger</ax-button>
            <ax-button disabled>Disabled</ax-button>
          </div>
        </section>

        <section class="glass-card">
          <h2>Toggle &amp; DIP switch</h2>
          <div class="row">
            <ax-toggle checked label="Single toggle"></ax-toggle>
            <ax-dipswitch class="dip-demo" switches="DEBUG,TRACE,MOCK,SAFE" on="DEBUG" label="Feature flags"></ax-dipswitch>
            <ax-button variant="ghost" class="dip-randomize">Stagger-set</ax-button>
          </div>
        </section>

        <section class="glass-card">
          <h2>Slider &rarr; Progress</h2>
          <ax-slider class="wired-slider" label="Drive the progress bar" value="40"></ax-slider>
          <ax-progress class="wired-progress" value="40" label="Driven progress"></ax-progress>
          <h3>Indeterminate</h3>
          <ax-progress indeterminate label="Loading"></ax-progress>
        </section>

        <section class="glass-card">
          <h2>Skeleton</h2>
          <div class="skeleton-stage">
            <ax-skeleton class="sk"></ax-skeleton>
            <p class="sk-content" hidden>Content arrived — the skeleton faded, no pop-in.</p>
          </div>
          <ax-button variant="outline" class="sk-replay">Replay load</ax-button>
        </section>

        <section class="glass-card">
          <h2>Popover</h2>
          <div class="pop-anchor">
            <ax-button variant="outline" class="pop-btn" aria-haspopup="true" aria-expanded="false">Open popover</ax-button>
            <ax-popover aria-label="Demo menu">
              <div class="settings-like"><ax-toggle label="Option A" checked></ax-toggle> Option A</div>
              <div class="settings-like"><ax-toggle label="Option B"></ax-toggle> Option B</div>
            </ax-popover>
          </div>
        </section>

        <section class="glass-card">
          <h2>Motion tokens</h2>
          <p class="token-note">Lanes replay at 4&times; the real duration so the curves are visible.</p>
          <div class="token-grid">
            ${DURATIONS.map(d => `
              <div class="token-row">
                <code>--duration-${d}</code>
                <div class="lane"><div class="ball dur" style="transition-duration: calc(var(--duration-${d}) * 4)"></div></div>
              </div>`).join('')}
            ${EASINGS.map(e => `
              <div class="token-row">
                <code>--${e}</code>
                <div class="lane"><div class="ball" style="transition-timing-function: var(--${e}); transition-duration: calc(var(--duration-slow) * 4)"></div></div>
              </div>`).join('')}
          </div>
          <ax-button variant="ghost" class="replay-tokens">Replay</ax-button>
        </section>

        <section class="glass-card">
          <h2>Route transitions</h2>
          <p>The router picks direction from <code>ROUTE_ORDER</code>: navigating left of this page slides back, right slides forward.</p>
          <div class="row">
            <a href="/home" class="btn btn-outline btn-secondary">&larr; Home (backward)</a>
            <a href="/dashboard" class="btn btn-outline btn-secondary">&larr; Dashboard (backward)</a>
            <a href="/contact" class="btn btn-outline btn-secondary">Contact (forward) &rarr;</a>
          </div>
        </section>
      </main>`;
    this._wire();
  }

  _wire() {
    const $ = (sel) => this.shadowRoot.querySelector(sel);

    $('.rm-toggle').addEventListener('change', e => {
      if (e.detail.checked) document.documentElement.dataset.motion = 'reduced';
      else delete document.documentElement.dataset.motion;
    });

    $('.load-demo').addEventListener('click', e => {
      const b = e.currentTarget;
      b.setAttribute('loading', '');
      setTimeout(() => b.removeAttribute('loading'), 1500);
    });

    $('.dip-randomize').addEventListener('click', () => {
      const dip = $('.dip-demo');
      const next = {};
      Object.keys(dip.value).forEach(k => { next[k] = Math.random() > 0.5; });
      dip.setAll(next);
    });

    $('.wired-slider').addEventListener('input', e => {
      $('.wired-progress').value = e.detail.value;
    });

    const replaySkeleton = () => {
      const sk = $('.sk'), content = $('.sk-content');
      sk.removeAttribute('done'); content.hidden = true;
      setTimeout(() => { sk.setAttribute('done', ''); content.hidden = false; }, 1800);
    };
    $('.sk-replay').addEventListener('click', replaySkeleton);
    replaySkeleton();

    $('.pop-btn').addEventListener('click', e => {
      $('ax-popover').toggle(e.currentTarget);
    });

    const replayTokens = () => {
      // Snap balls back to the start with transitions suppressed — without
      // this, re-adding .go two frames after removal restarts the forward
      // transition from near the end and the run looks instant.
      const grid = $('.token-grid');
      const balls = this.shadowRoot.querySelectorAll('.ball');
      grid.classList.add('resetting');
      balls.forEach(b => b.classList.remove('go'));
      void grid.offsetWidth; // commit the snap-back before re-enabling transitions
      grid.classList.remove('resetting');
      requestAnimationFrame(() => balls.forEach(b => b.classList.add('go')));
    };
    $('.replay-tokens').addEventListener('click', replayTokens);
    replayTokens();
  }
}

customElements.define('components-ui', ComponentsUI);
