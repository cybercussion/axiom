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
import '@shared/controls/ax-barchart.js';
import '@shared/controls/ax-ring.js';
import '@shared/controls/ax-progress-ring.js';
import '@shared/controls/ax-stat.js';
import '@shared/controls/ax-trend.js';
import '@shared/controls/ax-chip.js';
import '@shared/controls/ax-datestrip.js';
import '@shared/controls/ax-gauge.js';
import '@shared/controls/ax-stepper.js';
import '@shared/controls/ax-led.js';
import '@shared/controls/ax-knob.js';

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
          <h3>Fill variant (control-center style)</h3>
          <div class="fill-demos">
            <ax-slider variant="fill" label="Volume" value="65">
              <svg slot="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
            </ax-slider>
            <ax-slider variant="fill" label="Brightness" value="40">
              <svg slot="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="4"></circle>
                <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4"></path>
              </svg>
            </ax-slider>
          </div>
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
          <h2>Bar chart</h2>
          <ax-barchart class="demo-bars" unit="%" label="Demo bars"></ax-barchart>
          <ax-button variant="ghost" class="bars-randomize">Randomize</ax-button>
        </section>

        <section class="glass-card">
          <h2>Ring &amp; progress rings</h2>
          <div class="row">
            <ax-ring class="demo-ring" size="150" label="Demo ring">
              <span class="ring-pct">75%</span>
            </ax-ring>
            <div class="ring-gauges">
              <ax-progress-ring class="demo-pring" value="40" size="56" label="Demo gauge"></ax-progress-ring>
              <ax-slider class="pring-slider" label="Drive the gauge" value="40"></ax-slider>
            </div>
          </div>
        </section>

        <section class="glass-card">
          <h2>Stat, trend &amp; chip</h2>
          <div class="row">
            <ax-stat value="108" unit="bpm" label="Heart Rate">
              <span slot="icon">&hearts;</span>
              <ax-trend slot="trend" value="1.27"></ax-trend>
            </ax-stat>
            <ax-chip class="demo-chip" tone="ongoing">On Going</ax-chip>
            <ax-button variant="ghost" class="chip-toggle">Toggle tone</ax-button>
          </div>
        </section>

        <section class="glass-card">
          <h2>Date strip</h2>
          <ax-datestrip class="demo-strip"></ax-datestrip>
          <p class="strip-log token-note">Select a day&hellip;</p>
        </section>

        <section class="glass-card span-all">
          <h2>Cyber-Neumorphism</h2>
          <p class="token-note">Second surface tier: opacity + depth. Same tokens, same contracts.</p>
          <div class="neu-stage">
            <div class="neu-panel power-panel">
              <span class="power-label" aria-hidden="true">POWER</span>
              <ax-gauge class="power-gauge" value="29" unit="%" label="Battery power" height="220"></ax-gauge>
              <div class="power-mid">
                <span class="power-title">BATTERY POWER</span>
                <span class="power-readout"><strong class="power-num">29</strong> %</span>
                <ax-stepper class="power-stepper" value="29" min="0" max="100" step="1" label="Capacity"></ax-stepper>
                <span class="power-cap" aria-hidden="true">CAPACITY</span>
              </div>
              <div class="power-side">
                <div class="led-rail">
                  <ax-led tone="ok" label="Power"></ax-led>
                  <ax-led class="charge-led" tone="info" pulse label="Charging"></ax-led>
                  <ax-led tone="off" label="Fault"></ax-led>
                </div>
                <ax-button surface="neu" shape="round" class="power-on">ON</ax-button>
              </div>
            </div>
            <div class="neu-panel knob-panel">
              <ax-knob class="demo-knob" value="30" label="Volume"></ax-knob>
              <span class="knob-readout token-note">Volume: <strong class="knob-num">30</strong></span>
              <ax-toggle surface="neu" checked label="Neu slide switch"></ax-toggle>
              <ax-dipswitch surface="neu" switches="PWR,NET,DBG" on="PWR" label="Neu rockers"></ax-dipswitch>
              <ax-slider surface="neu" variant="fill" label="Neu groove" value="55"></ax-slider>
              <ax-progress surface="neu" value="72" label="Neu progress"></ax-progress>
            </div>
            <div class="neu-panel neu-viz-panel">
              <ax-barchart surface="neu" unit="%" max="100" label="Neu bars"
                data='[{"label":"Mon","value":42},{"label":"Tue","value":68},{"label":"Wed","value":30},{"label":"Thu","value":81},{"label":"Fri","value":55}]'></ax-barchart>
              <div class="neu-viz-row">
                <ax-ring surface="neu" size="120" label="Neu ring"
                  segments='[{"label":"Move","value":50},{"label":"Rest","value":30},{"label":"Focus","value":20}]'>
                  <span class="ring-pct">64%</span>
                </ax-ring>
                <ax-progress-ring surface="neu" value="83" size="56" label="Neu gauge"></ax-progress-ring>
                <ax-progress-ring surface="neu" value="100" size="56" label="Neu done"></ax-progress-ring>
              </div>
              <div class="neu-viz-row">
                <ax-stat surface="neu" value="7,412" label="Steps">
                  <svg slot="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4v6l4 2"></path><circle cx="12" cy="12" r="10"></circle></svg>
                </ax-stat>
                <ax-chip surface="neu" tone="complete">Complete</ax-chip>
                <ax-chip surface="neu" tone="ongoing">On Going</ax-chip>
              </div>
              <ax-datestrip surface="neu" label="Neu week"></ax-datestrip>
            </div>
          </div>
        </section>

        <section class="glass-card span-all">
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

        <section class="glass-card span-all">
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

    const seedBars = () => {
      $('.demo-bars').data = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        .map(label => ({ label, value: Math.round(Math.random() * 90) + 10 }));
    };
    $('.bars-randomize').addEventListener('click', seedBars);
    seedBars();

    $('.demo-ring').segments = [
      { label: 'Calories', value: 37.5 },
      { label: 'Protein', value: 37.5 },
      { label: 'Carbs', value: 25 }
    ];

    $('.pring-slider').addEventListener('input', e => {
      $('.demo-pring').value = e.detail.value;
    });

    $('.chip-toggle').addEventListener('click', () => {
      const chip = $('.demo-chip');
      const done = chip.getAttribute('tone') === 'complete';
      chip.setAttribute('tone', done ? 'ongoing' : 'complete');
      chip.textContent = done ? 'On Going' : 'Complete';
    });

    $('.demo-strip').addEventListener('change', e => {
      $('.strip-log').textContent = `change → ${e.detail.date}`;
    });

    $('.power-stepper').addEventListener('change', e => {
      $('.power-gauge').value = e.detail.value;
      $('.power-num').textContent = e.detail.value;
      $('.charge-led').setAttribute('tone', e.detail.value >= 100 ? 'ok' : 'info');
    });

    $('.demo-knob').addEventListener('input', e => {
      $('.knob-num').textContent = e.detail.value;
    });
    $('.demo-knob').addEventListener('change', e => {
      $('.knob-num').textContent = e.detail.value;
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
