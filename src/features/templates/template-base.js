/**
 * Project Axiom: Template Base
 * Base class for all course page templates.
 * Provides common functionality for interactions and page completion.
 */
import { BaseComponent } from '@shared/base-component.js';
import { state } from '@state';
import { course } from '@core/course-state.js';

export class TemplateBase extends BaseComponent {
  constructor() {
    super();
    this._startTime = null;
    this._submitted = false;
  }

  /**
   * Page data passed from player
   */
  get pageData() {
    return this._pageData || {};
  }

  set pageData(data) {
    this._pageData = data;
    if (this.isConnected) {
      this.render();
    }
  }

  /**
   * Unique interaction ID for SCORM
   */
  get interactionId() {
    return this.pageData?.id || `page-${state.get('coursePosition')}`;
  }

  /**
   * Weight for scoring (default: 1)
   */
  get weight() {
    return this.pageData?.weight || 1;
  }

  connectedCallback() {
    super.connectedCallback();
    this._startTime = Date.now();
  }

  /**
   * Calculate latency in ISO 8601 duration format
   */
  getLatency() {
    if (!this._startTime) return 'PT0S';
    const ms = Date.now() - this._startTime;
    const seconds = Math.round(ms / 1000);
    return `PT${seconds}S`;
  }

  /**
   * Mark this page as complete
   * @param {number|null} score - Optional score (0-100)
   * @param {string|null} response - Optional learner response for review
   */
  markComplete(score = null, response = null) {
    this.dispatchEvent(new CustomEvent('page-complete', {
      bubbles: true,
      composed: true,
      detail: {
        id: this.interactionId,
        score,
        response,
        latency: this.getLatency()
      }
    }));
  }

  /**
   * Record an interaction response
   * @param {string} type - Interaction type (choice, matching, fill-in, etc.)
   * @param {*} response - Learner response (string or array depending on type)
   * @param {string} result - 'correct' or 'incorrect'
   * @param {*} correctResponse - Correct response pattern (optional)
   */
  recordInteraction(type, response, result, correctResponse = null) {
    if (this._submitted) return; // Prevent double submission
    this._submitted = true;

    // SCORM interaction data
    // Note: learner_response can be array for choice/sequencing/matching types
    // SCOBot's encodeInteractionType handles the encoding
    const interaction = {
      id: String(this.interactionId),
      type: String(type),
      learner_response: response,  // Can be string or array depending on type
      result: String(result),
      weight: String(this.weight),
      latency: this.getLatency(),  // Already ISO 8601 duration string (PT#S)
      timestamp: new Date().toISOString()  // ISO 8601 string
    };

    // Add correct_responses if provided
    if (correctResponse !== null) {
      interaction.correct_responses = [{ pattern: correctResponse }];
    }

    this.dispatchEvent(new CustomEvent('interaction-submit', {
      bubbles: true,
      composed: true,
      detail: interaction
    }));

    return interaction;
  }

  /**
   * Show feedback based on result
   * @param {boolean} correct - Whether answer was correct
   */
  showFeedback(correct) {
    const feedback = this.pageData?.feedback;
    if (!feedback) return;

    const message = correct ? feedback.correct : feedback.incorrect;
    const feedbackEl = this.shadowRoot.querySelector('.feedback');
    
    if (feedbackEl && message) {
      feedbackEl.innerHTML = `
        <div class="feedback-content ${correct ? 'correct' : 'incorrect'}">
          <span class="feedback-icon">${correct ? '✓' : '✗'}</span>
          <p>${message}</p>
        </div>
      `;
      feedbackEl.hidden = false;
    }
  }

  /**
   * Utility: Shuffle an array (for randomizing choices)
   */
  shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Utility: Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
}
