/**
 * FormControlMixin — ElementInternals plumbing shared by form controls.
 * Adds formAssociated, reset/disabled lifecycle, and validity mirroring.
 * Controls may implement _formReset() (restore defaults from attributes)
 * and _sync() (re-render state); both hooks are optional.
 */
const VALIDITY_FLAGS = [
  'valueMissing', 'typeMismatch', 'patternMismatch', 'tooLong', 'tooShort',
  'rangeUnderflow', 'rangeOverflow', 'stepMismatch', 'badInput', 'customError'
];

export const FormControlMixin = (Base) => class extends Base {
  static formAssociated = true;

  constructor() {
    super();
    this._internals = this.attachInternals();
  }

  formResetCallback() {
    if (this._formReset) this._formReset();
  }

  formDisabledCallback(disabled) {
    this.toggleAttribute('data-form-disabled', disabled);
    // Fires synchronously on insertion into a disabled fieldset — possibly
    // BEFORE first render. Skip _sync until the shadow tree exists; render()
    // ends in _sync and reads data-form-disabled then.
    if (this._sync && this.shadowRoot.firstElementChild) this._sync();
  }

  _setFormValue(v) {
    this._internals.setFormValue(v);
  }

  /** Mirror a native inner input's validity onto the host's internals. */
  _mirrorValidity(input) {
    if (input.validity.valid) {
      this._internals.setValidity({});
      return;
    }
    const flags = {};
    for (const f of VALIDITY_FLAGS) {
      if (input.validity[f]) flags[f] = true;
    }
    this._internals.setValidity(flags, input.validationMessage, input);
  }
};
