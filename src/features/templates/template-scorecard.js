/**
 * Template: Scorecard
 * End-of-course results summary with score breakdown.
 */
import { TemplateBase } from './template-base.js';
import { state } from '@state';
import { course, courseActions } from '@core/course-state.js';

class TemplateScorecard extends TemplateBase {
  async setup() {
    await this.addExternalStyles(new URL('./templates.css', import.meta.url).href);
  }

  render() {
    const data = this.pageData;
    const interactions = state.get('interactions') || [];
    const score = course.score;
    const isPassing = course.isPassing;
    const passingScore = course.meta?.passingScore || 80;

    // Calculate stats
    const totalQuestions = interactions.length;
    const correctCount = interactions.filter(i => i.result === 'correct').length;
    const incorrectCount = totalQuestions - correctCount;

    // Determine status message
    const statusMessage = isPassing 
      ? (data.passMessage || 'Congratulations! You passed!')
      : (data.failMessage || 'You did not achieve a passing score.');

    this.shadowRoot.innerHTML = `
      <article class="template scorecard-template">
        <header class="scorecard-header">
          <div class="completion-icon ${isPassing ? 'passed' : 'failed'}">
            ${isPassing ? '🏆' : '📚'}
          </div>
          <h1>${this.escapeHtml(data.title || 'Course Complete')}</h1>
          <p class="completion-message">${this.escapeHtml(data.completionMessage || '')}</p>
        </header>

        <div class="score-display glass-card">
          <div class="score-circle ${isPassing ? 'passed' : 'failed'}">
            <span class="score-value">${score}</span>
            <span class="score-percent">%</span>
          </div>
          <p class="score-label">Your Score</p>
          <p class="passing-info">Passing Score: ${passingScore}%</p>
          <p class="status-message ${isPassing ? 'passed' : 'failed'}">${statusMessage}</p>
        </div>

        <div class="stats-grid">
          <div class="stat-card glass-card">
            <span class="stat-value correct">${correctCount}</span>
            <span class="stat-label">Correct</span>
          </div>
          <div class="stat-card glass-card">
            <span class="stat-value incorrect">${incorrectCount}</span>
            <span class="stat-label">Incorrect</span>
          </div>
          <div class="stat-card glass-card">
            <span class="stat-value">${totalQuestions}</span>
            <span class="stat-label">Total</span>
          </div>
        </div>

        ${data.showDetails && interactions.length > 0 ? `
          <section class="review-section glass-card">
            <h2>Question Review</h2>
            <ul class="review-list">
              ${interactions.map((interaction, index) => `
                <li class="review-item ${interaction.result}">
                  <span class="review-icon">${interaction.result === 'correct' ? '✓' : '✗'}</span>
                  <span class="review-id">${interaction.id || `Question ${index + 1}`}</span>
                  <span class="review-result">${interaction.result}</span>
                </li>
              `).join('')}
            </ul>
          </section>
        ` : ''}

        <div class="actions">
          ${!isPassing && course.settings?.allowReview ? `
            <button class="btn btn-secondary retry-btn">Review Course</button>
          ` : ''}
          <button class="btn btn-primary finish-btn">Finish</button>
        </div>
      </article>
    `;

    this.bindEvents();
    this.finalizeCourse(score, isPassing);
  }

  bindEvents() {
    const retryBtn = this.shadowRoot.querySelector('.retry-btn');
    retryBtn?.addEventListener('click', () => {
      // Go back to first page for review
      state.set('coursePosition', 0);
    });

    const finishBtn = this.shadowRoot.querySelector('.finish-btn');
    finishBtn?.addEventListener('click', () => {
      this.finishCourse();
    });
  }

  /**
   * Finish course - commit and terminate SCORM session
   */
  finishCourse() {
    const scorm = course.scorm;
    if (scorm) {
      // SCOBot's finish method commits and terminates
      scorm.finish();
    }
    
    // Optionally redirect or show completion message
    state.notify('Course completed! You may close this window.', 'success');
  }

  finalizeCourse(score, isPassing) {
    const scorm = course.scorm;
    if (!scorm || !scorm.isConnectionActive()) return;

    // Set final score (all values must be strings)
    scorm.setvalue('cmi.score.scaled', String(score / 100));
    scorm.setvalue('cmi.score.raw', String(score));
    scorm.setvalue('cmi.score.max', '100');
    scorm.setvalue('cmi.score.min', '0');

    // Set completion and success status
    scorm.setvalue('cmi.completion_status', 'completed');
    scorm.setvalue('cmi.success_status', isPassing ? 'passed' : 'failed');

    // Commit to LMS
    scorm.commit();

    // Mark scorecard as complete
    this.markComplete(score);
  }
}

customElements.define('template-scorecard', TemplateScorecard);
