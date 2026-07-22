import { BaseComponent } from '@shared/base-component.js';
import { state } from '@state';
import '@shared/controls/ax-field.js';
import '@shared/controls/ax-textarea.js';
import '@shared/controls/ax-button.js';

class ContactUI extends BaseComponent {
  // A11y: don't delegate the router's post-navigation focus() into the first
  // focusable child (scrolls it into view → mobile URL bar + focus ring);
  // focus the host container instead. Parity with daystrom page components.
  static delegatesFocus = false;

  async setup() {
    const cssPath = new URL('./contact.css', import.meta.url).href;
    await this.addExternalStyles(cssPath);
  }

  onRendered() {
    this.form = this.shadowRoot.querySelector('form');
    const message = this.shadowRoot.querySelector('[name="message"]');
    // Custom rule (replaces FormValidator's registerRule('nospam')):
    // the error property is a setCustomValidity proxy and shows immediately.
    message.addEventListener('input', e => {
      message.error = e.detail.value.toLowerCase().includes('spam') ? 'No spam allowed!' : '';
    });
    this.form.addEventListener('submit', e => this.handleSubmit(e));
  }

  disconnectedCallback() {
    this._sendController?.abort();
    super.disconnectedCallback();
  }

  async handleSubmit(e) {
    e.preventDefault();

    if (!this.form.checkValidity()) {
      // Mark every field touched so messages show, then focus the first
      // invalid host (formAssociated hosts match :invalid; delegatesFocus
      // routes focus() to the inner input).
      this.form.querySelectorAll('ax-field, ax-textarea').forEach(f => f.reportValidity());
      this.form.querySelector(':invalid')?.focus();
      return;
    }

    this._sendController?.abort();
    this._sendController = new AbortController();
    const { signal } = this._sendController;

    const submitBtn = this.shadowRoot.querySelector('ax-button');
    submitBtn.setAttribute('loading', '');

    await new Promise(r => setTimeout(r, 1500)); // simulated send
    if (signal.aborted) return;

    state.notify('Message sent successfully!', 'success', 4000);
    this.form.reset(); // controls restore via formResetCallback
    submitBtn.removeAttribute('loading');
  }

  render() {
    this.shadowRoot.innerHTML = `
      <div class="contact-container fade-in">
        <h1>Get in Touch</h1>
        <form class="glass-card contact-form" novalidate>
          <ax-field name="name" label="Name" placeholder="John Doe" required minlength="2"></ax-field>
          <ax-field name="email" type="email" label="Email Address" placeholder="john@example.com" required></ax-field>
          <ax-textarea name="message" label="Message" placeholder="How can we help?" required minlength="10" rows="4"></ax-textarea>
          <div class="actions">
            <ax-button type="submit" variant="fill" tone="primary">Send Message</ax-button>
          </div>
        </form>
      </div>
    `;
  }
}

customElements.define('contact-ui', ContactUI);
