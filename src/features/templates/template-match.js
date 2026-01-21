/**
 * Template: Match (Drag-and-Drop Matching)
 * Connect items from two columns.
 */
import { TemplateBase } from './template-base.js';
import { state } from '@state';
import { course } from '@core/course-state.js';

class TemplateMatch extends TemplateBase {
  constructor() {
    super();
    this._matches = new Map(); // sourceId -> targetId
    this._draggedItem = null;
  }

  async setup() {
    await this.addExternalStyles(new URL('./templates.css', import.meta.url).href);
  }

  render() {
    const data = this.pageData;
    const pairs = data.pairs || [];

    // Check if this question was already answered
    const progress = state.get('courseProgress') || {};
    const pageProgress = progress[state.get('coursePosition')];
    const isAnswered = pageProgress?.complete;

    // Shuffle targets for challenge (only if not already answered)
    const shuffledTargets = isAnswered ? pairs : this.shuffle(pairs);

    this.shadowRoot.innerHTML = `
      <article class="template match-template">
        <header class="page-header">
          ${data.title ? `<h2 class="page-title">${this.escapeHtml(data.title)}</h2>` : ''}
        </header>

        <div class="question-card glass-card">
          <p class="question-text">${this.escapeHtml(data.question)}</p>
          <p class="instruction">Drag items from the left to match with items on the right</p>

          <div class="match-container">
            <div class="source-column" role="list" aria-label="Items to match">
              ${pairs.map(p => `
                <div 
                  class="match-item source" 
                  draggable="${isAnswered ? 'false' : 'true'}" 
                  data-source-id="${p.sourceId}"
                  role="listitem"
                  ${isAnswered ? '' : 'tabindex="0"'}
                  aria-label="${this.escapeHtml(p.sourceText)}"
                >
                  <span class="match-text">${this.escapeHtml(p.sourceText)}</span>
                  <span class="match-status"></span>
                </div>
              `).join('')}
            </div>

            <div class="match-lines" aria-hidden="true">
              <!-- SVG lines drawn here -->
            </div>

            <div class="target-column" role="list" aria-label="Match targets">
              ${shuffledTargets.map(p => `
                <div 
                  class="match-item target" 
                  data-target-id="${p.targetId}"
                  role="listitem"
                  aria-label="${this.escapeHtml(p.targetText)}"
                >
                  <div class="drop-zone" data-accepts="${p.targetId}">
                    <span class="drop-placeholder">Drop here</span>
                  </div>
                  <span class="match-text">${this.escapeHtml(p.targetText)}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="actions">
            ${course.settings?.showResetButton !== false && !isAnswered ? '<button class="btn btn-secondary reset-btn">Reset</button>' : ''}
            <button class="btn btn-primary submit-btn" ${isAnswered ? 'disabled' : ''}>
              ${isAnswered ? 'Submitted' : 'Check Answers'}
            </button>
          </div>

          <div class="feedback" hidden aria-live="polite"></div>
        </div>
      </article>
    `;

    this.bindEvents();

    // If already answered, restore previous state
    if (isAnswered) {
      this.showPreviousAnswer(pageProgress);
    }
  }

  bindEvents() {
    // Drag events for source items
    const sources = this.shadowRoot.querySelectorAll('.source');
    sources.forEach(source => {
      source.addEventListener('dragstart', (e) => this.handleDragStart(e));
      source.addEventListener('dragend', (e) => this.handleDragEnd(e));
      
      // Keyboard support
      source.addEventListener('keydown', (e) => this.handleKeyboard(e, source));
    });

    // Drop zones
    const dropZones = this.shadowRoot.querySelectorAll('.drop-zone');
    dropZones.forEach(zone => {
      zone.addEventListener('dragover', (e) => this.handleDragOver(e));
      zone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
      zone.addEventListener('drop', (e) => this.handleDrop(e));
    });

    // Buttons
    this.shadowRoot.querySelector('.submit-btn')?.addEventListener('click', () => {
      this.handleSubmit();
    });

    this.shadowRoot.querySelector('.reset-btn')?.addEventListener('click', () => {
      this.handleReset();
    });
  }

  handleDragStart(e) {
    this._draggedItem = e.target;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.target.dataset.sourceId);
  }

  handleDragEnd(e) {
    e.target.classList.remove('dragging');
    this._draggedItem = null;

    // Remove all drag-over states
    this.shadowRoot.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
  }

  handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
  }

  handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const sourceId = e.dataTransfer.getData('text/plain');
    const targetId = e.currentTarget.dataset.accepts;

    if (sourceId && targetId) {
      this.createMatch(sourceId, targetId);
    }
  }

  handleKeyboard(e, source) {
    // Space or Enter to select/place
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      
      if (!this._selectedSource) {
        // Select this source
        this._selectedSource = source;
        source.classList.add('selected');
        
        // Focus first available target
        const firstTarget = this.shadowRoot.querySelector('.drop-zone:not(.matched)');
        firstTarget?.focus();
      }
    }
  }

  createMatch(sourceId, targetId) {
    // Remove any existing match for this source
    this._matches.delete(sourceId);

    // Remove any existing match for this target
    for (const [sId, tId] of this._matches) {
      if (tId === targetId) {
        this._matches.delete(sId);
        break;
      }
    }

    // Create new match
    this._matches.set(sourceId, targetId);

    // Update visual state
    this.updateMatchVisuals();

    // Enable submit if all matched
    const allMatched = this._matches.size === this.pageData.pairs.length;
    this.shadowRoot.querySelector('.submit-btn').disabled = !allMatched;
  }

  updateMatchVisuals() {
    // Reset all
    this.shadowRoot.querySelectorAll('.source').forEach(s => {
      s.classList.remove('matched');
    });
    this.shadowRoot.querySelectorAll('.drop-zone').forEach(z => {
      z.classList.remove('has-match');
      z.querySelector('.drop-placeholder').textContent = 'Drop here';
    });

    // Apply current matches
    this._matches.forEach((targetId, sourceId) => {
      const source = this.shadowRoot.querySelector(`[data-source-id="${sourceId}"]`);
      const dropZone = this.shadowRoot.querySelector(`[data-accepts="${targetId}"]`);
      
      if (source && dropZone) {
        source.classList.add('matched');
        dropZone.classList.add('has-match');
        dropZone.querySelector('.drop-placeholder').textContent = source.querySelector('.match-text').textContent;
      }
    });
  }

  handleReset() {
    this._matches.clear();
    this.updateMatchVisuals();
    this.shadowRoot.querySelector('.submit-btn').disabled = true;
    this.shadowRoot.querySelector('.feedback').hidden = true;
    
    // Remove result classes
    this.shadowRoot.querySelectorAll('.correct, .incorrect').forEach(el => {
      el.classList.remove('correct', 'incorrect');
    });
  }

  handleSubmit() {
    const data = this.pageData;
    let correctCount = 0;

    // Check each match
    data.pairs.forEach(pair => {
      const userMatch = this._matches.get(pair.sourceId);
      const isCorrect = userMatch === pair.targetId;
      
      if (isCorrect) correctCount++;

      // Visual feedback
      const source = this.shadowRoot.querySelector(`[data-source-id="${pair.sourceId}"]`);
      const dropZone = this.shadowRoot.querySelector(`[data-accepts="${userMatch}"]`);
      
      if (source) {
        source.classList.add(isCorrect ? 'correct' : 'incorrect');
      }
      if (dropZone) {
        dropZone.classList.add(isCorrect ? 'correct' : 'incorrect');
      }
    });

    const allCorrect = correctCount === data.pairs.length;
    const score = Math.round((correctCount / data.pairs.length) * 100);

    // Format response for SCORM: [[source1, target1], [source2, target2], ...]
    const response = Array.from(this._matches.entries());

    // Build correct response pattern
    const correctResponse = data.pairs.map(p => [p.sourceId, p.targetId]);

    // Record interaction
    this.recordInteraction('matching', response, allCorrect ? 'correct' : 'incorrect', correctResponse);

    // Show feedback
    this.showFeedback(allCorrect);

    // Disable further interaction
    this.shadowRoot.querySelectorAll('.source').forEach(s => {
      s.draggable = false;
      s.removeAttribute('tabindex');
    });
    this.shadowRoot.querySelector('.submit-btn').disabled = true;
    this.shadowRoot.querySelector('.submit-btn').textContent = 'Submitted';
    const resetBtn = this.shadowRoot.querySelector('.reset-btn');
    if (resetBtn) resetBtn.hidden = true;

    // Mark complete with response for review (string format)
    const responseStr = response.map(([s, t]) => `${s}.${t}`).join(',');
    this.markComplete(score, responseStr);
  }

  /**
   * Restore visual state from previous attempt
   */
  showPreviousAnswer(progress) {
    console.log('[TemplateMatch] showPreviousAnswer called with:', progress);
    if (!progress?.response) return;

    const data = this.pageData;

    // Parse response: "source1.target1,source2.target2,..."
    const matchPairs = progress.response.split(',');
    matchPairs.forEach(pair => {
      const [sourceId, targetId] = pair.split('.');
      if (sourceId && targetId) {
        this._matches.set(sourceId, targetId);
      }
    });

    // Update visual state with matches
    this.updateMatchVisuals();

    // Now show correct/incorrect highlighting
    data.pairs.forEach(pair => {
      const userMatch = this._matches.get(pair.sourceId);
      const isCorrect = userMatch === pair.targetId;

      const source = this.shadowRoot.querySelector(`[data-source-id="${pair.sourceId}"]`);
      const dropZone = this.shadowRoot.querySelector(`[data-accepts="${userMatch}"]`);

      if (source) {
        source.classList.add(isCorrect ? 'correct' : 'incorrect');
      }
      if (dropZone) {
        dropZone.classList.add(isCorrect ? 'correct' : 'incorrect');
      }
    });

    // Show feedback
    this.showFeedback(progress.score === 100);
  }
}

customElements.define('template-match', TemplateMatch);
