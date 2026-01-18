import { BaseComponent } from '@shared/base-component.js';
import { state } from '@state';
import { FormValidator } from '@shared/form-validator.js';
import '@shared/custom-input.js';

class ContactUI extends BaseComponent {

  async setup() {
    const cssPath = new URL('./contact.css', import.meta.url).href;
    const formsCssPath = new URL('../../shared/styles/forms.css', import.meta.url).href;
    await this.addExternalStyles(cssPath);
    await this.addExternalStyles(formsCssPath);
  }

  async onRendered() {
    this.form = this.shadowRoot.querySelector('form');

    if (this.form) {
      this.validator = new FormValidator(this.form);

      // Rule registration...
      this.validator.registerRule('nospam', (val) =>
        val.toLowerCase().includes('spam') ? 'No spam allowed!' : true
      );

      // Explicitly bind the submit listener to the Shadow form
      this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }
  }

  disconnectedCallback() {
    if (this.validator && this.validator._currentController) {
      this.validator._currentController.abort();
    }
    super.disconnectedCallback();
  }

  async handleSubmit(e) {
    // 1. STOP THE RELOAD
    e.preventDefault();
    e.stopPropagation();

    // 2. Validate
    const isValid = await this.validator.validateAll();
    if (!isValid) {
      // Find first invalid input and focus it
      const firstInvalid = this.shadowRoot.querySelector('.input-group.invalid input, .input-group.invalid textarea');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    // 3. Simulate API Call
    if (this.validator._currentController) {
      this.validator._currentController.abort();
    }
    this.validator._currentController = new AbortController();

    const submitBtn = this.shadowRoot.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.classList.add('loading'); // Use CSS for spinner

    // Simulate network delay
    try {
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      // Ignore aborts handled below
    }

    // Check for abort
    if (this.validator._currentController?.signal.aborted) return;

    state.notify('Success', 'Message sent successfully!', 4000);
    this.form.reset();

    // Reset visual state
    this.shadowRoot.querySelectorAll('custom-input').forEach(el => el.resetState());
    submitBtn.disabled = false;
    submitBtn.classList.remove('loading');
  }

  render() {
    this.shadowRoot.innerHTML = `
      <div class="contact-container fade-in">
        <h1>Get in Touch</h1>
        
        <form class="glass-card contact-form" novalidate>
          
          <custom-input>
            <input type="text" id="name" name="name" class="input-field" placeholder="John Doe" required minlength="2">
            <label for="name" class="input-label">Name</label>
          </custom-input>
          
          <custom-input>
            <input type="email" id="email" name="email" class="input-field" placeholder="john@example.com" required>
            <label for="email" class="input-label">Email Address</label>
          </custom-input>
          
          <custom-input>
            <textarea id="message" name="message" class="input-field" placeholder="How can we help?" required minlength="10" data-rule="nospam"></textarea>
            <label for="message" class="input-label">Message</label>
          </custom-input>
          
          <div class="actions">
            <button type="submit" class="btn btn-primary btn-fill btn-submit">Send Message</button>
          </div>
        </form>
      </div>
    `;
  }
}

customElements.define('contact-ui', ContactUI);