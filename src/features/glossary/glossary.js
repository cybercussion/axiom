/**
 * Project Axiom: Glossary Panel
 * Modal-based glossary with search functionality.
 * Uses axiom-modal for the container.
 */
import { BaseComponent } from '@shared/base-component.js';
import { state } from '@state';
import { course } from '@core/course-state.js';
import '@shared/modal.js';

class GlossaryPanel extends BaseComponent {
  constructor() {
    super();
    this._searchTerm = '';
  }

  async connectedCallback() {
    await this.addExternalStyles(new URL('./glossary.css', import.meta.url).href);
    super.connectedCallback();

    // Subscribe to glossary open state
    this.subscribe('glossaryOpen', (open) => {
      const modal = this.shadowRoot.querySelector('axiom-modal');
      if (modal) {
        open ? modal.open() : modal.close();
      }
    });
  }

  render() {
    const terms = course.glossary || [];

    this.shadowRoot.innerHTML = `
      <axiom-modal title="Glossary" size="md">
        <div class="glossary-content">
          <div class="search-box">
            <input 
              type="search" 
              placeholder="Search terms..." 
              class="glossary-search"
              aria-label="Search glossary"
            >
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>

          <ul class="glossary-list" role="list">
            ${terms.map(term => `
              <li class="glossary-item" data-term="${this.escapeHtml(term.term.toLowerCase())}">
                <dt class="term-title">${this.escapeHtml(term.term)}</dt>
                <dd class="term-definition">${this.escapeHtml(term.definition)}</dd>
              </li>
            `).join('')}
          </ul>

          ${terms.length === 0 ? `
            <p class="empty-state">No glossary terms available for this course.</p>
          ` : ''}

          <p class="no-results" hidden>No matching terms found.</p>
        </div>

        <div slot="actions">
          <button class="btn btn-secondary close-glossary">Close</button>
        </div>
      </axiom-modal>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const modal = this.shadowRoot.querySelector('axiom-modal');
    const searchInput = this.shadowRoot.querySelector('.glossary-search');
    const closeBtn = this.shadowRoot.querySelector('.close-glossary');

    // Search functionality
    searchInput?.addEventListener('input', (e) => {
      this._searchTerm = e.target.value.toLowerCase().trim();
      this.filterTerms();
    });

    // Close button
    closeBtn?.addEventListener('click', () => {
      state.set('glossaryOpen', false);
    });

    // Handle modal close event
    modal?.addEventListener('close', () => {
      state.set('glossaryOpen', false);
      // Reset search on close
      if (searchInput) searchInput.value = '';
      this._searchTerm = '';
      this.filterTerms();
    });
  }

  filterTerms() {
    const items = this.shadowRoot.querySelectorAll('.glossary-item');
    const noResults = this.shadowRoot.querySelector('.no-results');
    let visibleCount = 0;

    items.forEach(item => {
      const term = item.dataset.term;
      const matches = !this._searchTerm || term.includes(this._searchTerm);
      
      item.hidden = !matches;
      if (matches) visibleCount++;
    });

    // Show no results message
    if (noResults) {
      noResults.hidden = visibleCount > 0 || !this._searchTerm;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
}

customElements.define('glossary-panel', GlossaryPanel);
