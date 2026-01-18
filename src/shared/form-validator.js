/**
 * Axiom Form Validator
 * 
 * A lightweight wrapper around the native Constraint Validation API.
 * Adds support for custom rules, async validation, and cohesive error handling.
 */
export class FormValidator {
  constructor(formElement) {
    this.form = formElement;
    this.inputs = Array.from(formElement.querySelectorAll('input, textarea, select'));
    this._customRules = new Map();

    // Bind listeners
    this.form.addEventListener('input', this._handleInput.bind(this));
    this.form.addEventListener('submit', this._handleSubmit.bind(this));

    // Disable native validation UI bubbles
    this.form.setAttribute('novalidate', 'true');
  }

  /**
   * Register a custom validation rule
   * @param {string} name - internal name
   * @param {Function} callback - (value, input) => Promise<boolean|string> | boolean|string
   * Returns true/null if valid, or an error message string if invalid.
   */
  registerRule(name, callback) {
    this._customRules.set(name, callback);
  }

  async validateField(input) {
    // 1. Reset custom validity to checking...
    input.setCustomValidity('');

    // 2. Check Native Constraints (required, type, pattern, etc.)
    const isValidNative = input.checkValidity();

    if (!isValidNative) {
      this._updateUI(input, false, input.validationMessage);
      return false;
    }

    // 3. Check Custom Rules (if any active)
    // We check for data-rules="ruleName"
    const ruleName = input.dataset.rule;
    if (ruleName && this._customRules.has(ruleName)) {
      const result = await this._customRules.get(ruleName)(input.value, input);

      if (result !== true && result !== null) {
        // It's an error string
        input.setCustomValidity(result);
        this._updateUI(input, false, result);
        return false;
      }
    }

    // 4. Success
    this._updateUI(input, true);
    return true;
  }

  async validateAll() {
    const results = await Promise.all(this.inputs.map(input => this.validateField(input)));
    return results.every(valid => valid);
  }

  _updateUI(input, isValid, message) {
    // Find the parent <custom-input>
    const wrapper = input.closest('custom-input') || (input.getRootNode() && input.getRootNode().host);
    if (wrapper && wrapper.setState) {
      wrapper.setState(isValid, message);
    } else {
      // Fallback for non-wrapped inputs
      isValid ? input.classList.remove('invalid') : input.classList.add('invalid');
    }
  }

  _handleInput(e) {
    // Debounce validation slightly for better UX
    if (this._debounce) clearTimeout(this._debounce);
    this._debounce = setTimeout(() => {
      this.validateField(e.target);
    }, 300);
  }

  _handleSubmit(e) {
    // We don't prevent default here automatically; the caller should do that.
    // This just ensures we validate everything before they proceed.
    if (!this.form.checkValidity()) {
      e.preventDefault();
      this.validateAll(); // Force show UI errors
    }
  }
}
