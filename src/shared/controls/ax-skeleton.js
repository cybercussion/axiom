/**
 * <ax-skeleton> — shimmer placeholder. Size via consumer CSS.
 * Set the `done` attribute when real content arrives: fades out, then
 * leaves layout (display transition, allow-discrete — no hard cut).
 */
import { BaseComponent } from '@shared/base-component.js';

const CSS = `
  :host {
    display: block; position: relative; overflow: hidden;
    min-height: 1em; border-radius: 8px;
    background: var(--input-bg);
    transition: opacity var(--duration-base) var(--ease-out-soft),
      display var(--duration-base) allow-discrete;
  }
  :host::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.07), transparent);
    translate: -100% 0;
    animation: ax-shimmer 1.6s var(--ease-cinematic) infinite; /* motion-gate: allow */
  }
  @keyframes ax-shimmer { to { translate: 100% 0; } }
  :host([done]) { opacity: 0; display: none; }
`;

export class AxSkeleton extends BaseComponent {
  constructor() {
    super();
    this.addStyles(CSS);
    this.setAttribute('aria-hidden', 'true');
  }
  render() { this.shadowRoot.innerHTML = ''; }
}

customElements.define('ax-skeleton', AxSkeleton);
