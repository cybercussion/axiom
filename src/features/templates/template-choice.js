/**
 * Template: Choice (Multiple Choice / Multiple Select)
 * Supports single and multiple answer questions.
 */
import { TemplateBase } from './template-base.js';
import { state } from '@state';
import { course } from '@core/course-state.js';

class TemplateChoice extends TemplateBase {
  async setup() {
    await this.addExternalStyles(new URL('./templates.css', import.meta.url).href);
  }

  render() {
    const data = this.pageData;
    const isMultiSelect = data.multiSelect === true;
    const inputType = isMultiSelect ? 'checkbox' : 'radio';
    
    // Check if this question was already answered (from local state)
    const progress = state.get('courseProgress') || {};
    const pageProgress = progress[state.get('coursePosition')];
    const isAnswered = pageProgress?.complete;

    // Optionally shuffle choices
    let choices = data.choices || [];
    if (course.settings?.shuffleChoices && !isAnswered) {
      choices = this.shuffle(choices);
    }

    this.shadowRoot.innerHTML = `
      <article class="template choice-template">
        <header class="page-header">
          ${data.title ? `<h2 class="page-title">${this.escapeHtml(data.title)}</h2>` : ''}
        </header>

        <div class="question-card glass-card">
          <p class="question-text">${this.escapeHtml(data.question)}</p>
          
          ${isMultiSelect ? '<p class="instruction">Select all that apply</p>' : ''}

          <fieldset class="choices-container">
            <legend class="sr-only">${this.escapeHtml(data.question)}</legend>
            
            ${choices.map((choice, index) => `
              <label class="choice-option" data-choice-id="${choice.id}">
                <input 
                  type="${inputType}" 
                  name="choice" 
                  value="${choice.id}"
                  ${isAnswered ? 'disabled' : ''}
                >
                <span class="choice-indicator"></span>
                <span class="choice-text">${this.escapeHtml(choice.text)}</span>
              </label>
            `).join('')}
          </fieldset>

          <div class="actions">
            <button class="btn btn-primary submit-btn" ${isAnswered ? 'disabled' : ''}>
              ${isAnswered ? 'Submitted' : 'Submit Answer'}
            </button>
          </div>

          <div class="feedback" hidden aria-live="polite"></div>
        </div>
      </article>
    `;

    this.bindEvents();

    // If already answered, show previous state
    if (isAnswered) {
      this.showPreviousAnswer(pageProgress);
    }
  }

  bindEvents() {
    const submitBtn = this.shadowRoot.querySelector('.submit-btn');
    
    submitBtn?.addEventListener('click', () => {
      this.handleSubmit();
    });

    // Enable submit when selection made
    const inputs = this.shadowRoot.querySelectorAll('input');
    inputs.forEach(input => {
      input.addEventListener('change', () => {
        const hasSelection = this.shadowRoot.querySelector('input:checked');
        submitBtn.disabled = !hasSelection;
      });
    });

    // Initially disable submit until selection
    submitBtn.disabled = true;
  }

  handleSubmit() {
    const data = this.pageData;
    const selected = [...this.shadowRoot.querySelectorAll('input:checked')]
      .map(input => input.value);

    if (selected.length === 0) return;

    // Determine correct answers
    const correctIds = data.choices
      .filter(c => c.correct)
      .map(c => c.id)
      .sort();

    // Check if answer is correct
    const isCorrect = JSON.stringify(selected.sort()) === JSON.stringify(correctIds);

    // Record interaction - pass array for choice type (SCOBot encodes it)
    this.recordInteraction(
      'choice',
      selected,  // Array of selected choice IDs
      isCorrect ? 'correct' : 'incorrect',
      correctIds  // Correct response pattern
    );

    // Visual feedback
    this.showFeedback(isCorrect);
    this.highlightAnswers(correctIds, selected);

    // Disable further input
    this.shadowRoot.querySelectorAll('input').forEach(i => i.disabled = true);
    this.shadowRoot.querySelector('.submit-btn').disabled = true;
    this.shadowRoot.querySelector('.submit-btn').textContent = 'Submitted';

    // Mark complete with score and response for review
    const score = isCorrect ? 100 : 0;
    this.markComplete(score, selected.join(','));
  }

  highlightAnswers(correctIds, selectedIds) {
    const options = this.shadowRoot.querySelectorAll('.choice-option');
    
    options.forEach(option => {
      const id = option.dataset.choiceId;
      const isCorrect = correctIds.includes(id);
      const wasSelected = selectedIds.includes(id);

      if (isCorrect) {
        option.classList.add('correct');
      }
      if (wasSelected && !isCorrect) {
        option.classList.add('incorrect');
      }
    });
  }

  showPreviousAnswer(progress) {
    // Restore visual state from previous attempt
    console.log('[TemplateChoice] showPreviousAnswer called with:', progress);
    if (progress?.response) {
      const selectedIds = progress.response.split(',');
      console.log('[TemplateChoice] Restoring selected IDs:', selectedIds);
      selectedIds.forEach(id => {
        const input = this.shadowRoot.querySelector(`input[value="${id}"]`);
        if (input) input.checked = true;
      });

      const correctIds = this.pageData.choices
        .filter(c => c.correct)
        .map(c => c.id);

      this.highlightAnswers(correctIds, selectedIds);
      this.showFeedback(progress.score === 100);
    }
  }
}

customElements.define('template-choice', TemplateChoice);
