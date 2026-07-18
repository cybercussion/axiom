import { BaseComponent } from '@shared/base-component.js';
import { state } from '@state';
import '@shared/controls/ax-barchart.js';
import '@shared/controls/ax-ring.js';
import '@shared/controls/ax-progress-ring.js';
import '@shared/controls/ax-stat.js';
import '@shared/controls/ax-trend.js';
import '@shared/controls/ax-chip.js';
import '@shared/controls/ax-datestrip.js';

class DashboardUI extends BaseComponent {
  // A11y: don't delegate the router's post-navigation focus() into the first
  // focusable child (scrolls it into view → mobile URL bar + focus ring);
  // focus the host container instead. Parity with daystrom page components.
  static delegatesFocus = false;

  async setup() {
    // Robust path resolution for the CSS sibling
    const cssPath = new URL('./dashboard.css', import.meta.url).href;
    await this.addExternalStyles(cssPath);

    // Subscribe to data changes
    this.subscribe('dashboardData', (val) => this.render(val));
    this.subscribe('theme', () => { /* re-render handled by BaseComponent style adoption */ });
  }

  async connectedCallback() {
    // 1. Let the Brain sync the theme and initial attributes
    await super.connectedCallback();

    // 2. Reactivity is already handled by subscription.
    // Ensure we show current state immediately if available.
    const initialData = state.get('dashboardData');
    if (initialData) {
      this.render(initialData);
    }
  }

  render(dashboardState = {}) {
    if (!dashboardState || dashboardState.status === 'loading') {
      this.shadowRoot.innerHTML = `
        <div class="dashboard-container center-content">
          <div class="spinner"></div>
          <p>Acquiring Satellite Uplink...</p>
        </div>
      `;
      return;
    }

    // 2. Error State
    if (dashboardState?.status === 'error') {
      const errorMsg = dashboardState.error?.message || 'Unknown Error';
      this.shadowRoot.innerHTML = `
        <div class="dashboard-container center-content">
          <div class="glass-card panel error-panel">
            <h2 class="text-danger">Signal Lost</h2>
            <p>Unable to fetch dashboard telemetry.</p>
            <code class="error-code">${errorMsg}</code>
            <button class="btn btn-secondary" onclick="state.notify('Retrying Uplink...', 'warning', 2000); state.query('dashboardData', () => import('src/features/dashboard/dashboard-api.js').then(m => m.fetchDashboardData()))">Retry Uplink</button>
          </div>
        </div>
      `;
      return;
    }

    // Surgical extraction: Handle both wrapped and unwrapped data
    const payload = dashboardState.data || dashboardState;

    // Each icon carries slot="icon" so it is the TOP-LEVEL slotted element —
    // ax-stat's ::slotted(svg) sizing only matches top-level nodes.
    const icons = {
      heart: `<svg slot="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>`,
      distance: `<svg slot="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.5" r="2.5"></circle><path d="m10.2 9.4-3.7 4.1 3 2.2L8 21"></path><path d="m13.8 9.4 2.3 2.9 3.9 1.2"></path><path d="M10.2 9.4c.6-.7 1.5-1.1 2.4-.9l1.2.3"></path></svg>`,
      water: `<svg slot="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69 6.34 8.34a8 8 0 1 0 11.31 0z"></path></svg>`
    };
    const p = payload;
    const selDate = p.week?.selected ? new Date(`${p.week.selected}T00:00:00`) : null;
    const monthLabel = selDate && !Number.isNaN(selDate.getTime())
      ? selDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : 'This week';

    this.shadowRoot.innerHTML = `
      <div class="dashboard-container">
        <header class="dash-header"><h1>${this._esc(p.title || 'Dashboard')}</h1></header>
        <div class="glass-panel dash-grid">

          <section class="glass-tile panel-activity">
            <h2>Activity</h2>
            <ax-barchart unit="${this._esc(p.activity?.unit || '')}" label="Weekly activity"></ax-barchart>
          </section>

          <section class="stat-col">
            ${(p.stats || []).map(s => `
              <ax-stat value="${this._esc(s.value)}" unit="${this._esc(s.unit)}" label="${this._esc(s.label)}">
                ${icons[s.icon] || ''}
              </ax-stat>`).join('')}
          </section>

          <section class="glass-tile panel-overview">
            <h2>Overview</h2>
            <div class="overview-body">
              <ax-ring size="160" label="Daily overview">
                <span class="ring-pct">${Number(p.overview?.percent) || 0}%</span>
                <span class="ring-sub">${this._esc(p.overview?.centerLabel || '')}</span>
                <div slot="legend" class="overview-legend">
                  ${(p.overview?.segments || []).map((s, i) => `
                    <div class="legend-line">
                      <span class="dot" style="background: var(--chart-${i + 1})"></span>
                      <span class="legend-label">${this._esc(s.label)}</span>
                      <strong>${s.value}</strong>
                      <ax-trend value="${Number(s.trend) || 0}"></ax-trend>
                    </div>`).join('')}
                </div>
              </ax-ring>
            </div>
          </section>

          <section class="glass-tile panel-challenges">
            <h2>Challenges</h2>
            ${(p.challenges || []).map(c => `
              <div class="challenge-row">
                <ax-progress-ring value="${Number(c.progress) || 0}" size="40" label="${this._esc(c.title)}"></ax-progress-ring>
                <span class="challenge-title">${this._esc(c.title)}</span>
                <span class="challenge-fraction">${this._esc(c.fraction)}</span>
                <ax-chip tone="${c.state === 'complete' ? 'complete' : 'ongoing'}">${c.state === 'complete' ? 'Complete' : 'On Going'}</ax-chip>
              </div>`).join('')}
          </section>

          <section class="glass-tile panel-week">
            <h2>${this._esc(monthLabel)}</h2>
            <ax-datestrip date="${this._esc(p.week?.anchor || '')}" selected="${this._esc(p.week?.selected || '')}"></ax-datestrip>
          </section>

          <section class="glass-tile panel-output">
            <h2>Output</h2>
            <div class="output-row">
              <ax-stat value="${this._esc(p.output?.value || '')}" unit="${this._esc(p.output?.unit || '')}" label="${this._esc(p.output?.label || '')}">
                <ax-trend slot="trend" value="${Number(p.output?.trend) || 0}" good></ax-trend>
              </ax-stat>
              <ax-chip tone="neutral">${this._esc(p.output?.badge || '')}</ax-chip>
            </div>
          </section>

        </div>
      </div>`;

    // Charts take structured data via properties (attributes can't carry arrays cleanly).
    this.shadowRoot.querySelector('ax-barchart').data = p.activity?.days || [];
    this.shadowRoot.querySelector('ax-ring').segments = p.overview?.segments || [];
  }
}
customElements.define('dashboard-ui', DashboardUI);