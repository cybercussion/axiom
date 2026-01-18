import { BaseComponent } from '@shared/base-component.js';
import { state } from '@state';

class DashboardUI extends BaseComponent {
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

    // Fallback values so the UI doesn't show "undefined"
    const {
      systemStatus = 'ONLINE',
      cpu = 'N/A',
      memory = 'N/A',
      network = 'N/A'
    } = payload;

    this.shadowRoot.innerHTML = `
      <div class="dashboard-container">
        <header class="dash-header">
          <h1>Dashboard</h1>
          <p class="subtitle">System Status: <span class="status-ok">${systemStatus}</span></p>
        </header>

        <div class="grid">
          <!-- Stat Cards -->
          <article class="glass-card stat">
            <div class="label">CPU Load</div>
            <div class="value">${cpu}</div>
            <div class="chart-line"></div>
          </article>
          
          <article class="glass-card stat">
            <div class="label">Memory</div>
            <div class="value">${memory}</div>
            <div class="chart-line"></div>
          </article>
          
          <article class="glass-card stat">
            <div class="label">Network</div>
            <div class="value">${network}</div>
            <div class="chart-line"></div>
          </article>

          <!-- Main Controls -->
          <section class="glass-card panel controls">
            <h2>System Controls</h2>
            <div class="button-grid">
              <button class="btn btn-primary btn-fill" onclick="state.notify('Deployment Initiated', 'info')">Deploy</button>
              <button class="btn btn-secondary btn-fill" onclick="state.notify('Rollback Sequence Started', 'warning')">Rollback</button>
              <button class="btn btn-success btn-outline" onclick="state.notify('Diagnostics Running...', 'success')">Run Diagnostics</button>
              <button class="btn btn-warning btn-ghost" onclick="state.notify('Cache Cleared', 'info')">Clear Cache</button>
              <button class="btn btn-danger btn-outline" onclick="state.notify('Database Purged', 'error')">Purge DB</button>
              <button class="btn btn-primary btn-outline" onclick="state.notify('Log Stream Opened', 'info')">View Logs</button>
            </div>
          </section>

          <!-- Configuration (Toggles & Radios) -->
          <section class="glass-card panel config">
            <h2>Configuration</h2>
            <div class="form-group">
              <h3>Preferences</h3>
              <label class="toggle">
                <input type="checkbox" checked onchange="state.set('turboMode', this.checked); state.notify('Turbo Mode ' + (this.checked ? 'Enabled' : 'Disabled'))">
                <span class="slider"></span>
                <span class="label-text">Turbo Mode</span>
              </label>
              <label class="toggle">
                <input type="checkbox">
                <span class="slider"></span>
                <span class="label-text">Silent Notifications</span>
              </label>
            </div>
            
            <div class="form-group">
              <h3>Density</h3>
              <div class="radio-group">
                <label class="radio">
                  <input type="radio" name="density" checked>
                  <span class="radio-mark"></span>
                  Compact
                </label>
                <label class="radio">
                  <input type="radio" name="density">
                  <span class="radio-mark"></span>
                  Comfortable
                </label>
              </div>
            </div>
          </section>

          <!-- Activity Log (Rich List) -->
          <section class="glass-card panel logs">
            <h2>Recent Activity</h2>
            <ul class="rich-list">
              <li class="list-item">
                <div class="icon-box info">i</div>
                <div class="content">
                  <div class="title">System Initialized</div>
                  <div class="meta">v1.2.0 • Just now</div>
                </div>
                <button class="btn-icon">⋮</button>
              </li>
              <li class="list-item">
                <div class="icon-box success">✓</div>
                <div class="content">
                  <div class="title">Data Source Connected</div>
                  <div class="meta">Took 12ms</div>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </div>
    `;
  }
}
customElements.define('dashboard-ui', DashboardUI);