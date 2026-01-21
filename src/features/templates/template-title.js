/**
 * Template: Title Page
 * Course intro, section headers, or informational pages.
 */
import { TemplateBase } from './template-base.js';

class TemplateTitle extends TemplateBase {
  async setup() {
    await this.addExternalStyles(new URL('./templates.css', import.meta.url).href);
  }

  render() {
    const data = this.pageData;

    this.shadowRoot.innerHTML = `
      <article class="template title-page">
        ${data.image ? `
          <div class="hero-image">
            <img src="${this.escapeHtml(data.image)}" alt="" loading="eager">
          </div>
        ` : ''}

        <header class="page-header">
          <h1 class="title">${this.escapeHtml(data.title)}</h1>
          ${data.subtitle ? `<p class="subtitle">${this.escapeHtml(data.subtitle)}</p>` : ''}
          ${data.duration ? `<span class="duration">⏱ ${this.escapeHtml(data.duration)}</span>` : ''}
        </header>

        ${data.objectives?.length ? `
          <section class="objectives glass-card">
            <h2>Learning Objectives</h2>
            <ul>
              ${data.objectives.map(obj => `<li>${this.escapeHtml(obj)}</li>`).join('')}
            </ul>
          </section>
        ` : ''}

        ${data.content ? `
          <div class="content-body">
            ${data.content}
          </div>
        ` : ''}
      </article>
    `;

    // Title pages are auto-complete
    this.markComplete();
  }
}

customElements.define('template-title', TemplateTitle);
