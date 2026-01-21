/**
 * Template: Word Puzzle (Fill-in-the-Blank)
 * Text with blanks that learners fill in.
 */
import { TemplateBase } from './template-base.js';
import { state } from '@state';

class TemplateWordpuzzle extends TemplateBase {
  async setup() {
    await this.addExternalStyles(new URL('./templates.css', import.meta.url).href);
  }

  render() {
    const data = this.pageData;

    // Build puzzle content - we'll insert inputs AFTER rendering to avoid HTML parsing issues
    const blanksInfo = [];
    let processedText = this.escapeHtml(data.text || '');
    
    // Replace blank placeholders with span markers
    (data.blanks || []).forEach((blank, index) => {
      const placeholder = `{{${blank.id}}}`;
      const maxLength = Math.max(...blank.answers.map(a => a.length)) + 5;
      const width = Math.max(80, maxLength * 10);
      
      // Use a span as placeholder that we'll replace with real input after render
      const spanMarker = `<span class="blank-placeholder" data-blank-id="${blank.id}" data-index="${index}" data-width="${width}"></span>`;
      processedText = processedText.replace(placeholder, spanMarker);
      blanksInfo.push({ id: blank.id, index, width });
    });

    // Preserve line breaks
    processedText = processedText.replace(/\n/g, '<br>');

    this.shadowRoot.innerHTML = `
      <article class="template wordpuzzle-template">
        <header class="page-header">
          ${data.title ? `<h2 class="page-title">${this.escapeHtml(data.title)}</h2>` : ''}
        </header>

        <div class="question-card glass-card">
          ${data.question ? `<p class="question-text">${this.escapeHtml(data.question)}</p>` : ''}
          <p class="instruction">Fill in the blanks to complete the text</p>

          <div class="puzzle-container">
            <div class="puzzle-text">${processedText}</div>
          </div>

          <div class="actions">
            <button class="btn btn-primary submit-btn" disabled>Check Answers</button>
          </div>

          <div class="feedback" hidden aria-live="polite"></div>
        </div>
      </article>
    `;

    // Now replace span placeholders with actual input elements
    this.shadowRoot.querySelectorAll('.blank-placeholder').forEach(span => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'puzzle-blank';
      input.dataset.blankId = span.dataset.blankId;
      input.dataset.index = span.dataset.index;
      input.placeholder = '...';
      input.autocomplete = 'off';
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('spellcheck', 'false');
      input.setAttribute('aria-label', `Blank ${parseInt(span.dataset.index) + 1}`);
      
      // Apply styles directly
      Object.assign(input.style, {
        width: `${span.dataset.width}px`,
        appearance: 'none',
        webkitAppearance: 'none',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        border: '1px solid rgba(59, 130, 246, 0.5)',
        borderRadius: '4px',
        color: '#e4e4e7',
        padding: '4px 8px',
        margin: '0 2px',
        fontFamily: 'inherit',
        fontSize: 'inherit',
        textAlign: 'center',
        verticalAlign: 'baseline',
        caretColor: '#e4e4e7',
        outline: 'none'
      });
      input.style.setProperty('-webkit-text-fill-color', '#e4e4e7', 'important');
      
      span.replaceWith(input);
    });

    // Check if already answered
    const progress = state.get('courseProgress') || {};
    const pageProgress = progress[state.get('coursePosition')];
    const isAnswered = pageProgress?.complete;

    this.bindEvents();

    // Restore previous answers if already completed
    if (isAnswered) {
      this.showPreviousAnswer(pageProgress);
    }
  }

  bindEvents() {
    const inputs = this.shadowRoot.querySelectorAll('.puzzle-blank');
    const submitBtn = this.shadowRoot.querySelector('.submit-btn');

    // Enable submit when all blanks filled
    const checkAllFilled = () => {
      const allFilled = [...inputs].every(input => input.value.trim() !== '');
      submitBtn.disabled = !allFilled;
    };

    inputs.forEach((input, index) => {
      // Focus styling
      input.addEventListener('focus', () => {
        input.style.borderColor = '#3b82f6';
        input.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.3)';
        input.style.backgroundColor = 'rgba(59, 130, 246, 0.25)';
      });
      input.addEventListener('blur', () => {
        if (!input.classList.contains('correct') && !input.classList.contains('incorrect')) {
          input.style.borderColor = 'rgba(59, 130, 246, 0.5)';
          input.style.boxShadow = 'none';
          input.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
        }
      });

      input.addEventListener('input', checkAllFilled);
      
      // Navigate between blanks with Tab/Enter
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const nextInput = inputs[index + 1];
          if (nextInput) {
            nextInput.focus();
          } else {
            // Focus submit if last blank
            submitBtn.focus();
          }
        }
      });
    });

    submitBtn?.addEventListener('click', () => {
      this.handleSubmit();
    });
  }

  handleSubmit() {
    const data = this.pageData;
    const inputs = this.shadowRoot.querySelectorAll('.puzzle-blank');
    const responses = [];
    let correctCount = 0;
    const totalBlanks = data.blanks?.length || 0;

    inputs.forEach(input => {
      const blankId = input.dataset.blankId;
      const userAnswer = input.value.trim();
      const blank = data.blanks.find(b => b.id === blankId);
      
      // Check if answer matches any accepted answer (case-insensitive)
      const isCorrect = blank?.answers.some(
        answer => answer.toLowerCase() === userAnswer.toLowerCase()
      );

      responses.push(`${blankId}:${userAnswer}`);
      
      if (isCorrect) {
        correctCount++;
        input.classList.add('correct');
        input.style.borderColor = '#22c55e';
        input.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
        input.style.boxShadow = 'none';
      } else {
        input.classList.add('incorrect');
        input.style.borderColor = '#ef4444';
        input.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
        input.style.boxShadow = 'none';
        // Show correct answer as tooltip
        input.title = `Correct: ${blank?.answers[0] || ''}`;
      }

      input.disabled = true;
    });

    const allCorrect = correctCount === totalBlanks;
    const score = totalBlanks > 0 ? Math.round((correctCount / totalBlanks) * 100) : 0;

    // Format response for SCORM fill-in
    const response = responses.join(',');

    // Build correct response pattern (first accepted answer for each blank)
    const correctResponse = {
      case_matters: false,
      words: data.blanks.map(b => b.answers[0])
    };

    // Record interaction
    this.recordInteraction('fill-in', response, allCorrect ? 'correct' : 'incorrect', correctResponse);

    // Show feedback
    this.showFeedback(allCorrect);

    // Update UI
    const submitBtn = this.shadowRoot.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitted';

    // Mark complete with response for review
    this.markComplete(score, response);
  }

  /**
   * Restore visual state from previous attempt
   */
  showPreviousAnswer(progress) {
    console.log('[TemplateWordpuzzle] showPreviousAnswer called with:', progress);
    if (!progress?.response) return;

    const data = this.pageData;
    const inputs = this.shadowRoot.querySelectorAll('.puzzle-blank');
    const submitBtn = this.shadowRoot.querySelector('.submit-btn');

    // Parse response: "blank1:answer1,blank2:answer2,..."
    const answers = {};
    progress.response.split(',').forEach(pair => {
      const [blankId, answer] = pair.split(':');
      if (blankId && answer !== undefined) {
        answers[blankId] = answer;
      }
    });

    // Restore each input
    inputs.forEach(input => {
      const blankId = input.dataset.blankId;
      const userAnswer = answers[blankId] || '';
      const blank = data.blanks?.find(b => b.id === blankId);

      input.value = userAnswer;
      input.disabled = true;

      // Check correctness and apply styling
      const isCorrect = blank?.answers.some(
        answer => answer.toLowerCase() === userAnswer.toLowerCase()
      );

      if (isCorrect) {
        input.classList.add('correct');
        input.style.borderColor = '#22c55e';
        input.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
        input.style.boxShadow = 'none';
      } else {
        input.classList.add('incorrect');
        input.style.borderColor = '#ef4444';
        input.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
        input.style.boxShadow = 'none';
        input.title = `Correct: ${blank?.answers[0] || ''}`;
      }
    });

    // Update submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitted';

    // Show feedback
    this.showFeedback(progress.score === 100);
  }
}

customElements.define('template-wordpuzzle', TemplateWordpuzzle);
