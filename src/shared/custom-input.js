import { BaseComponent } from './base-component.js';

/**
 * Custom Input Wrapper
 * 
 * A semantic wrapper for native inputs that provides:
 * 1. Floating Label logic (via CSS)
 * 2. Error message display (via ARIA)
 * 3. Validation state styling
 * 
 * Usage:
 * <custom-input>
 *   <input type="email" placeholder=" " required name="email" class="input-field" id="email">
 *   <label for="email" class="input-label">Email Address</label>
 * </custom-input>
 */
export class CustomInput extends BaseComponent {
  // Remove custom constructor/connectedCallback to let BaseComponent handle setup
  // constructor() { super(); }

  // connectedCallback() {
  //   this.render();
  // }

  /**
   * Set Validation State
   * @param {boolean} isValid 
   * @param {string} [message] 
   */
  setState(isValid, message = '') {
    const container = this.querySelector('.input-group');
    const errorEl = this.querySelector('.error-message');

    if (!container || !errorEl) return;

    if (isValid) {
      container.classList.remove('invalid');
      container.classList.add('valid');
      errorEl.textContent = '';
      errorEl.setAttribute('aria-hidden', 'true');
    } else {
      container.classList.remove('valid');
      container.classList.add('invalid');
      errorEl.textContent = message;
      errorEl.setAttribute('aria-hidden', 'false');
    }
  }

  /**
   * Reset Visual State
   * Clears both valid and invalid classes.
   */
  resetState() {
    const container = this.querySelector('.input-group');
    const errorEl = this.querySelector('.error-message');

    if (!container || !errorEl) return;

    container.classList.remove('invalid', 'valid');
    errorEl.textContent = '';
    errorEl.setAttribute('aria-hidden', 'true');
  }

  /**
   * Render is called by BaseComponent.connectedCallback
   */
  render() {
    // 1. Critical: Ensure Shadow DOM has a slot so Light DOM is visible
    this.shadowRoot.innerHTML = '<slot></slot>';

    // 2. Perform Light DOM wrapping logic
    // We are wrapping Light DOM content, so we just wrap it with our structure
    // if it isn't already wrapped.

    // Check if we are already hydrated (prevents duplicate wrapping)
    if (this.querySelector('.input-group')) return;

    // Extract light DOM children
    const children = Array.from(this.childNodes);

    // Create structure
    const wrapper = document.createElement('div');
    wrapper.className = 'input-group';

    // Generate unique ID for error message
    const errorId = `error-${Math.random().toString(36).substr(2, 9)}`;

    // Create Live Region for Errors
    const errorDisplay = document.createElement('div');
    errorDisplay.className = 'error-message';
    errorDisplay.id = errorId;
    errorDisplay.setAttribute('aria-live', 'polite');
    errorDisplay.setAttribute('aria-hidden', 'true');

    // Find input and link it
    const input = children.find(c => ['INPUT', 'TEXTAREA', 'SELECT'].includes(c.tagName));

    if (input) {
      if (!input.id) input.id = `input-${Math.random().toString(36).substr(2, 9)}`;
      const existing = input.getAttribute('aria-describedby') || '';
      input.setAttribute('aria-describedby', existing ? `${existing} ${errorId}` : errorId);
    }

    // Move children into wrapper
    children.forEach(child => wrapper.appendChild(child));

    // Append Error Display
    wrapper.appendChild(errorDisplay);

    this.appendChild(wrapper);
  }
}

customElements.define('custom-input', CustomInput);
