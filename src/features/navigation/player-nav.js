/**
 * Project Axiom: Player Navigation
 * Bottom-docked e-learning navigation bar with prev/next, page status, and tool access.
 * Follows the nav-dock.js pattern for consistency.
 */
import { BaseComponent } from '@shared/base-component.js';
import { state } from '@state';
import { course, courseActions } from '@core/course-state.js';

export class PlayerNav extends BaseComponent {
  async connectedCallback() {
    await this.addExternalStyles(new URL('./player-nav.css', import.meta.url).href);
    super.connectedCallback();

    // Subscribe to position and progress changes
    this._cleanups = [
      state.subscribe(({ key }) => {
        if (key === 'coursePosition' || key === 'courseProgress') {
          this.updateNavState();
        }
      }),
      state.subscribe(({ key, value }) => {
        if (key === 'feedbackOpen') {
          this.updateFeedbackButton(value);
        }
      })
    ];

    this.updateNavState();
  }

  disconnectedCallback() {
    this._cleanups?.forEach(fn => fn());
    super.disconnectedCallback();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <nav class="player-nav" role="navigation" aria-label="Course Navigation">
        <!-- Feedback Toggle -->
        <button class="nav-btn feedback-btn" aria-label="Notes & Feedback" aria-pressed="false" title="Notes & Feedback">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
        </button>

        <!-- Center Navigation -->
        <div class="nav-center">
          <button class="nav-btn prev-btn" disabled aria-label="Previous Page">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            <span class="btn-label">Previous</span>
          </button>

          <div class="page-status" role="status" aria-live="polite">
            <span class="current">0</span>
            <span class="separator">of</span>
            <span class="total">0</span>
          </div>

          <button class="nav-btn next-btn" disabled aria-label="Next Page">
            <span class="btn-label">Next</span>
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

        <!-- Tools Menu -->
        <button class="nav-btn tools-btn" aria-label="Course Tools" aria-haspopup="true" title="Glossary & Resources">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>
      </nav>

      <!-- Feedback Drawer (injected here to share styles) -->
      <feedback-drawer></feedback-drawer>

      <!-- Tools Panel -->
      <div class="tools-panel" role="menu" aria-label="Course Tools" hidden>
        <button class="tool-item" data-action="glossary">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
          </svg>
          <span>Glossary</span>
        </button>
        <button class="tool-item" data-action="resources">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
          </svg>
          <span>Resources</span>
        </button>
        <button class="tool-item" data-action="theme">
          <svg class="icon theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <span>Toggle Theme</span>
        </button>
        <hr class="tool-divider">
        <button class="tool-item danger" data-action="reset">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
          <span>Reset Course</span>
        </button>
      </div>
    `;

    this.bindEvents();
    this.updateNavState();
  }

  bindEvents() {
    // Navigation buttons
    this.ref('prev', '.prev-btn').addEventListener('click', () => {
      courseActions.prevPage();
    });

    this.ref('next', '.next-btn').addEventListener('click', () => {
      courseActions.nextPage();
    });

    // Feedback toggle
    this.ref('feedback', '.feedback-btn').addEventListener('click', () => {
      const isOpen = state.get('feedbackOpen');
      state.set('feedbackOpen', !isOpen);
    });

    // Tools menu toggle
    this.ref('tools', '.tools-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleToolsPanel();
    });

    // Tools panel actions
    this.ref('toolsPanel', '.tools-panel').addEventListener('click', (e) => {
      const item = e.target.closest('[data-action]');
      if (item) {
        this.handleToolAction(item.dataset.action);
      }
    });

    // Close tools panel on outside click
    document.addEventListener('click', () => {
      const panel = this.ref('toolsPanel', '.tools-panel');
      if (panel && !panel.hidden) {
        panel.hidden = true;
      }
    });
  }

  updateNavState() {
    const prevBtn = this.ref('prev', '.prev-btn');
    const nextBtn = this.ref('next', '.next-btn');
    const currentEl = this.ref('current', '.current');
    const totalEl = this.ref('total', '.total');

    if (prevBtn) prevBtn.disabled = !course.canPrev;
    if (nextBtn) {
      nextBtn.disabled = !course.canNext;
      
      // Show hint if locked due to unanswered question
      const settings = course.settings;
      const currentPage = course.currentPage;
      const progress = state.get('courseProgress') || {};
      const pos = state.get('coursePosition');
      const interactiveTypes = ['choice', 'match', 'wordpuzzle'];
      const isInteractive = interactiveTypes.includes(currentPage?.type);
      const isAnswered = progress[pos]?.complete;
      
      if (settings.requireAnswerToAdvance !== false && isInteractive && !isAnswered) {
        nextBtn.title = 'Answer the question to continue';
      } else {
        nextBtn.title = '';
      }
    }

    if (currentEl) currentEl.textContent = state.get('coursePosition') + 1;
    if (totalEl) totalEl.textContent = course.totalPages;
  }

  updateFeedbackButton(isOpen) {
    const btn = this.ref('feedback', '.feedback-btn');
    if (btn) {
      btn.setAttribute('aria-pressed', String(isOpen));
      btn.classList.toggle('active', isOpen);
    }
  }

  toggleToolsPanel() {
    const panel = this.ref('toolsPanel', '.tools-panel');
    if (panel) {
      panel.hidden = !panel.hidden;
    }
  }

  handleToolAction(action) {
    const panel = this.ref('toolsPanel', '.tools-panel');
    if (panel) panel.hidden = true;

    switch (action) {
      case 'glossary':
        state.set('glossaryOpen', true);
        break;
      case 'resources':
        state.set('resourcesOpen', true);
        break;
      case 'theme':
        const currentTheme = state.get('theme') || 'dark';
        state.set('theme', currentTheme === 'dark' ? 'light' : 'dark');
        break;
      case 'reset':
        this.resetCourse();
        break;
    }
  }

  resetCourse() {
    if (!confirm('Reset all progress and start over?')) return;
    
    // Clear SCOBot local storage
    const scorm = course.scorm;
    if (scorm) {
      // Reset SCORM data
      scorm.setvalue('cmi.location', '0');
      scorm.setvalue('cmi.suspend_data', '');
      scorm.setvalue('cmi.completion_status', 'incomplete');
      scorm.setvalue('cmi.success_status', 'unknown');
      scorm.setvalue('cmi.score.raw', '');
      scorm.commit();
    }
    
    // Clear local state
    state.set('coursePosition', 0);
    state.set('courseProgress', {});
    state.set('interactions', []);
    state.set('learnerComments', '');
    
    // Clear SCOBot localStorage (for standalone mode)
    localStorage.removeItem('SCOBot');
    
    state.notify('Course reset!', 'success');
    
    // Reload to fresh state
    location.reload();
  }
}

customElements.define('player-nav', PlayerNav);
