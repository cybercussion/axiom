/**
 * Project Axiom: Feedback Drawer
 * Slide-out panel for learner notes and LMS comments.
 * Used within player-nav component.
 */
import { BaseComponent } from '@shared/base-component.js';
import { state } from '@state';
import { course, courseActions } from '@core/course-state.js';

export class FeedbackDrawer extends BaseComponent {
  async connectedCallback() {
    await this.addExternalStyles(new URL('./player-nav.css', import.meta.url).href);
    super.connectedCallback();

    // Subscribe to open state
    this.subscribe('feedbackOpen', (open) => {
      this.toggleAttribute('open', open);
      if (open) {
        this.focusTrap();
      }
    });

    // Load any existing comments
    this.loadComments();
  }

  loadComments() {
    const scorm = course.scorm;
    if (scorm && scorm.isConnectionActive()) {
      const lmsComments = scorm.getvalue('cmi.comments_from_lms.0.comment') || '';
      const learnerComments = scorm.getvalue('cmi.comments_from_learner.0.comment') || '';
      state.set('lmsComments', lmsComments);
      state.set('learnerComments', learnerComments);
    }
  }

  render() {
    const lmsComments = state.get('lmsComments') || '';
    const learnerComments = state.get('learnerComments') || '';

    this.shadowRoot.innerHTML = `
      <aside class="feedback-drawer" role="complementary" aria-label="Feedback Panel">
        <header class="drawer-header">
          <h2>Notes & Feedback</h2>
          <button class="close-btn" aria-label="Close feedback panel">&times;</button>
        </header>

        <div class="drawer-content">
          ${lmsComments ? `
            <section class="lms-comments">
              <h3>Instructor Comments</h3>
              <p>${this.escapeHtml(lmsComments)}</p>
            </section>
          ` : ''}

          <section class="learner-comments">
            <h3>Your Notes</h3>
            <textarea 
              placeholder="Add your notes, questions, or reflections here..."
              aria-label="Your notes"
              spellcheck="true"
            >${this.escapeHtml(learnerComments)}</textarea>
          </section>
        </div>

        <footer class="drawer-footer">
          <button class="btn btn-primary save-btn">Save Notes</button>
        </footer>
      </aside>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // Close button
    this.shadowRoot.querySelector('.close-btn').addEventListener('click', () => {
      this.close();
    });

    // Save button
    this.shadowRoot.querySelector('.save-btn').addEventListener('click', () => {
      this.saveNotes();
    });

    // Auto-save on blur (optional UX enhancement)
    const textarea = this.shadowRoot.querySelector('textarea');
    textarea.addEventListener('blur', () => {
      const text = textarea.value.trim();
      const current = state.get('learnerComments') || '';
      if (text !== current) {
        this.saveNotes(true); // Silent save
      }
    });

    // Keyboard handling
    this.shadowRoot.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.saveNotes();
      }
    });
  }

  saveNotes(silent = false) {
    const textarea = this.shadowRoot.querySelector('textarea');
    const text = textarea.value.trim();
    
    courseActions.saveLearnerComments(text);
    
    if (!silent) {
      // Visual feedback on button
      const btn = this.shadowRoot.querySelector('.save-btn');
      const originalText = btn.textContent;
      btn.textContent = 'Saved!';
      btn.disabled = true;
      
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 1500);
    }
  }

  close() {
    state.set('feedbackOpen', false);
  }

  focusTrap() {
    // Focus the textarea when drawer opens
    requestAnimationFrame(() => {
      const textarea = this.shadowRoot.querySelector('textarea');
      if (textarea) {
        textarea.focus();
      }
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

customElements.define('feedback-drawer', FeedbackDrawer);
