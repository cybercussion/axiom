/**
 * Project Axiom: Player Feature
 * Main course player shell that loads scobot.json and renders templates.
 */
import { BaseComponent } from '@shared/base-component.js';
import { state } from '@state';
import { log } from '@core/logger.js';
import { config } from '@core/config.js';
import { initCourseState, course, courseActions } from '@core/course-state.js';
import { SCOBot } from '@scobot';

// Template registry - maps type to component tag
const TEMPLATE_REGISTRY = {
  'title-page': 'template-title',
  'choice': 'template-choice',
  'match': 'template-match',
  'wordpuzzle': 'template-wordpuzzle',
  'scorecard': 'template-scorecard'
};

class PlayerUI extends BaseComponent {
  async setup() {
    const cssPath = new URL('./player.css', import.meta.url).href;
    await this.addExternalStyles(cssPath);

    // Initialize course state defaults
    initCourseState();
    state.set('courseActive', true);
    
    // Don't subscribe to data changes yet - we'll do that after SCORM restore
  }

  async connectedCallback() {
    await super.connectedCallback();

    // Load course data (don't render yet)
    await this.loadCourse();

    // Initialize SCORM and restore session (this may update position/progress)
    await this.initScorm();
    
    // NOW subscribe to state changes for future navigation
    this.subscribe('coursePosition', () => this.renderCurrentPage());
    
    // Debug: Log state before initial render
    console.log('[Player] Initial render - position:', state.get('coursePosition'), 
                'progress:', state.get('courseProgress'));
    
    // Render the initial page (with restored state if available)
    this.renderCurrentPage();
  }

  disconnectedCallback() {
    // Cleanup course mode
    state.set('courseActive', false);
    
    // Terminate SCORM session
    const scorm = course.scorm;
    if (scorm) {
      courseActions.syncToScorm();
      scorm.terminate();
    }

    super.disconnectedCallback();
  }

  async loadCourse() {
    try {
      const response = await fetch('data/scobot.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      state.set('courseData', data);
      
      log.info(`Course loaded: ${data.meta?.title || 'Untitled'}`);
    } catch (err) {
      log.error('Failed to load course data', err);
      state.notify('Failed to load course content', 'error');
      this.renderError(err);
    }
  }

  async initScorm() {
    // SCOBot is imported directly via import map
    if (SCOBot) {
      try {
        // Enable debug: URL param overrides config.DEBUG
        const urlParams = new URLSearchParams(window.location.search);
        const debugEnabled = urlParams.has('debug') ? true : config.DEBUG;
        
        // SCOBot options
        const options = {
          debug: debugEnabled,
          prefix: 'SCOBot',
          use_standalone: true,   // Failover to Mock API if no LMS found
          compression: true,      // Compress data to save space
          exit_type: 'suspend'    // Default exit behavior
        };
        
        if (debugEnabled) {
          log.info('SCOBot debug mode enabled');
        }
        
        const scorm = new SCOBot(options);
        const initialized = scorm.initialize();
        
        if (initialized === 'true') {
          state.set('scorm', scorm);
          log.info(`SCORM initialized (SCOBot connected)`);
          
          // Restore previous session if available
          courseActions.restoreFromScorm();
        } else {
          log.info('SCORM API not found - running in standalone mode');
        }
      } catch (err) {
        log.warn('SCORM initialization failed (standalone mode)', err);
      }
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <div class="player-container">
        <header class="player-header">
          <h1 class="course-title"></h1>
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
        </header>

        <main class="player-content" role="main" aria-live="polite">
          <!-- Dynamic template content -->
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading course...</p>
          </div>
        </main>
      </div>

      <!-- Player Navigation -->
      <player-nav></player-nav>

      <!-- Glossary Modal -->
      <glossary-panel></glossary-panel>
    `;

    // Dynamically import components
    import('@features/navigation/player-nav.js');
    import('@features/navigation/feedback-drawer.js');
    import('@features/glossary/glossary.js');
  }

  renderCurrentPage() {
    const pageData = course.currentPage;
    if (!pageData) return;

    const content = this.ref('content', '.player-content');
    const title = this.ref('title', '.course-title');
    const progressFill = this.ref('progress', '.progress-fill');

    // Update header
    if (title) {
      title.textContent = course.meta?.title || 'Course';
    }

    // Update progress bar
    if (progressFill) {
      progressFill.style.width = `${course.completionPercent}%`;
    }

    // Get template tag for this page type
    const templateTag = TEMPLATE_REGISTRY[pageData.type];
    
    if (!templateTag) {
      log.error(`Unknown page type: ${pageData.type}`);
      content.innerHTML = `
        <div class="error-state">
          <h2>Unknown Page Type</h2>
          <p>Page type "${pageData.type}" is not supported.</p>
        </div>
      `;
      return;
    }

    // Dynamically load template component
    this.loadTemplate(templateTag, pageData, content);
  }

  async loadTemplate(tag, pageData, container) {
    // Import the template module
    try {
      await import(`@features/templates/${tag}.js`);
    } catch (err) {
      log.error(`Failed to load template: ${tag}`, err);
      container.innerHTML = `
        <div class="error-state">
          <h2>Template Error</h2>
          <p>Failed to load template for this page.</p>
          <code>${err.message}</code>
        </div>
      `;
      return;
    }

    // Create and render the template element
    const element = document.createElement(tag);
    element.setAttribute('data-page-id', pageData.id);
    
    // Pass page data via property (more flexible than attributes)
    element.pageData = pageData;

    // Listen for completion events
    element.addEventListener('page-complete', (e) => {
      courseActions.markPageComplete(e.detail.score, { response: e.detail.response });
    });

    element.addEventListener('interaction-submit', (e) => {
      courseActions.recordInteraction(e.detail);
    });

    // Swap content with transition
    container.innerHTML = '';
    container.appendChild(element);

    // Auto-complete title pages and informational pages
    if (['title-page'].includes(pageData.type)) {
      requestAnimationFrame(() => {
        courseActions.markPageComplete();
      });
    }
  }

  renderError(error) {
    const content = this.ref('content', '.player-content');
    if (content) {
      content.innerHTML = `
        <div class="error-state">
          <h2>Course Load Error</h2>
          <p>Unable to load the course content.</p>
          <code>${error.message}</code>
          <button class="btn btn-primary" onclick="location.reload()">Retry</button>
        </div>
      `;
    }
  }
}

customElements.define('player-ui', PlayerUI);
