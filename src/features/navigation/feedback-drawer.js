/**
 * Project Axiom: Feedback Drawer
 * Slide-out panel for learner notes and LMS comments.
 * Displays a chat-like interface for bi-directional feedback.
 */
import { BaseComponent } from '@shared/base-component.js';
import { state } from '@state';
import { course, courseActions } from '@core/course-state.js';

export class FeedbackDrawer extends BaseComponent {
  async connectedCallback() {
    await this.addExternalStyles(new URL('./player-nav.css', import.meta.url).href);
    this.addStyles(this.chatStyles());
    super.connectedCallback();

    // Subscribe to open state
    this.subscribe('feedbackOpen', (open) => {
      this.toggleAttribute('open', open);
      if (open) {
        this.loadComments();
        this.render();
        this.focusTrap();
      }
    });

    // Initial load
    this.loadComments();
  }

  loadComments() {
    // Load all comments (merged LMS + learner, sorted by timestamp)
    const comments = courseActions.getAllComments();
    state.set('allComments', comments);
  }

  chatStyles() {
    return `
      .chat-container {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1rem;
        overflow-y: auto;
        flex: 1;
        min-height: 200px;
        max-height: 60vh;
      }

      .chat-message {
        display: flex;
        flex-direction: column;
        max-width: 85%;
        padding: 0.75rem 1rem;
        border-radius: 1rem;
        animation: fadeIn 0.2s ease;
      }

      .chat-message.from-lms {
        align-self: flex-start;
        background: var(--glass-bg, rgba(255,255,255,0.1));
        border-bottom-left-radius: 0.25rem;
      }

      .chat-message.from-learner {
        align-self: flex-end;
        background: var(--accent-primary, #4a90d9);
        color: white;
        border-bottom-right-radius: 0.25rem;
      }

      .chat-message .message-text {
        font-size: 0.95rem;
        line-height: 1.4;
        word-wrap: break-word;
      }

      .chat-message .message-meta {
        display: flex;
        gap: 0.5rem;
        font-size: 0.75rem;
        opacity: 0.7;
        margin-top: 0.25rem;
      }

      .chat-message.from-learner .message-meta {
        justify-content: flex-end;
      }

      .chat-input-area {
        display: flex;
        align-items: stretch;
        gap: 0.5rem;
        padding: 1rem;
        border-top: 1px solid var(--border-color, rgba(255,255,255,0.1));
      }

      .chat-input-area textarea {
        flex: 1;
        min-height: 44px;
        max-height: 120px;
        resize: none;
        padding: 0.625rem 0.75rem;
        border-radius: 0.5rem;
        border: 1px solid var(--border-color, rgba(255,255,255,0.2));
        background: var(--input-bg, rgba(0,0,0,0.2));
        color: inherit;
        font-family: inherit;
        font-size: 0.95rem;
        line-height: 1.5;
      }

      .chat-input-area textarea:focus {
        outline: none;
        border-color: var(--accent-primary, #4a90d9);
      }

      .send-btn {
        padding: 0 1.25rem;
        min-height: 44px;
        background: var(--accent-primary, #4a90d9);
        color: white;
        border: none;
        border-radius: 0.5rem;
        cursor: pointer;
        font-weight: 500;
        transition: background 0.2s;
      }

      .send-btn:hover {
        background: var(--accent-hover, #5a9fe9);
      }

      .send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        opacity: 0.6;
        text-align: center;
      }

      .empty-state svg {
        width: 48px;
        height: 48px;
        margin-bottom: 1rem;
        opacity: 0.5;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
  }

  render() {
    const comments = state.get('allComments') || [];

    this.shadowRoot.innerHTML = `
      <aside class="feedback-drawer" role="complementary" aria-label="Feedback Panel">
        <header class="drawer-header">
          <h2>Notes & Feedback</h2>
          <button class="close-btn" aria-label="Close feedback panel">&times;</button>
        </header>

        <div class="chat-container" role="log" aria-live="polite">
          ${comments.length === 0 ? this.renderEmptyState() : this.renderMessages(comments)}
        </div>

        <div class="chat-input-area">
          <textarea 
            placeholder="Type your question or note..."
            aria-label="Your message"
            rows="2"
          ></textarea>
          <button class="send-btn" aria-label="Send message">Send</button>
        </div>
      </aside>
    `;

    this.bindEvents();
    this.scrollToBottom();
  }

  renderEmptyState() {
    return `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <p>No messages yet.</p>
        <p>Add notes, questions, or feedback below.</p>
      </div>
    `;
  }

  renderMessages(comments) {
    return comments.map(c => {
      // SCOBot may return 'false' string for empty values
      const comment = (c.comment && c.comment !== 'false') ? c.comment : '';
      const location = (c.location && c.location !== 'false') ? c.location : '';
      const timestamp = (c.timestamp && c.timestamp !== 'false') ? c.timestamp : '';

      if (!comment) return ''; // Skip empty comments

      return `
        <div class="chat-message from-${c.from}">
          <div class="message-text">${this.escapeHtml(comment)}</div>
          <div class="message-meta">
            ${location ? `<span class="location">${this.escapeHtml(location)}</span>` : ''}
            ${timestamp ? `<span class="time">${this.formatTimestamp(timestamp)}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  formatTimestamp(isoString) {
    try {
      if (!isoString || isoString === 'false') return '';
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return ''; // Invalid date
      return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  }

  scrollToBottom() {
    requestAnimationFrame(() => {
      const container = this.shadowRoot.querySelector('.chat-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }

  bindEvents() {
    // Close button
    this.shadowRoot.querySelector('.close-btn').addEventListener('click', () => {
      this.close();
    });

    // Send button
    this.shadowRoot.querySelector('.send-btn').addEventListener('click', () => {
      this.sendMessage();
    });

    // Textarea: Enter to send (Shift+Enter for newline)
    const textarea = this.shadowRoot.querySelector('textarea');
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Keyboard handling
    this.shadowRoot.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    });
  }

  sendMessage() {
    const textarea = this.shadowRoot.querySelector('textarea');
    const text = textarea.value.trim();

    if (!text) return;

    // Get current page as location context
    const currentPage = course.currentPage;
    const location = currentPage?.title || '';

    // Add the comment
    const success = courseActions.addLearnerComment(text, location);

    if (success) {
      textarea.value = '';
      this.loadComments();
      this.render();
    }
  }

  close() {
    state.set('feedbackOpen', false);
  }

  focusTrap() {
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
