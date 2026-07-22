/**
 * <ax-select label="Drive mode" options='[{"value":"s","label":"Sport"}]' value="s">
 * Single-select dropdown. We OWN the open menu — the OS-native popup would
 * shatter the neu tier the moment it opens. ARIA select-only combobox:
 * focus NEVER leaves the trigger (aria-activedescendant tracks the active
 * option), which keeps the keyboard model simple and correct.
 * Type-ahead reset is a PLAIN interaction constant (input cadence, not a
 * transition wait — stepper precedent).
 */
import { BaseComponent } from '@shared/base-component.js';
import { FormControlMixin } from './form-control-mixin.js';
import { FIELD_CHROME_CSS } from './field-chrome.js';
import { log } from '@core/logger.js';

const TYPEAHEAD_RESET_MS = 500;

const CSS = FIELD_CHROME_CSS + `
  .anchor { position: relative; }
  .well { padding: 0; }
  .trigger {
    all: unset; box-sizing: border-box;
    display: flex; align-items: center; gap: var(--space-xs);
    width: 100%; min-height: 44px;
    padding: 0 var(--space-m);
    cursor: pointer;
    color: var(--color-foreground);
    font: inherit; font-size: var(--text-base);
  }
  .sel.placeholder { color: var(--input-placeholder); }
  .chevron {
    margin-left: auto; flex-shrink: 0;
    width: 16px; height: 16px; color: var(--color-muted);
    transition: transform var(--duration-fast) var(--ease-out-soft);
  }
  :host([open]) .chevron { transform: rotate(180deg); }
  .menu {
    position: absolute; z-index: 101; left: 0; right: 0;
    top: calc(100% + var(--space-2xs));
    margin: 0; padding: var(--space-2xs); list-style: none;
    background: var(--neu-face);
    border-radius: 12px;
    box-shadow: var(--neu-raised), 0 14px 28px var(--neu-dark);
    max-height: 280px; overflow-y: auto;
    display: none; opacity: 0;
    transform: scale(0.96) translateY(-4px);
    transform-origin: top center;
    transition: opacity var(--duration-fast) var(--ease-out-soft),
      transform var(--duration-fast) var(--ease-out-soft),
      display var(--duration-fast) allow-discrete;
  }
  :host([open]) .menu { display: block; opacity: 1; transform: none; }
  @starting-style {
    :host([open]) .menu { opacity: 0; transform: scale(0.96) translateY(-4px); }
  }
  :host([data-flip]) .menu {
    top: auto; bottom: calc(100% + var(--space-2xs));
    transform: scale(0.96) translateY(4px);
    transform-origin: bottom center;
  }
  :host([data-flip][open]) .menu { transform: none; }
  @starting-style {
    :host([data-flip][open]) .menu { opacity: 0; transform: scale(0.96) translateY(4px); }
  }
  .option {
    display: flex; align-items: center; gap: var(--space-s);
    min-height: 44px; padding: 0 var(--space-s);
    border-radius: 8px; cursor: pointer;
    color: var(--color-foreground);
  }
  .option:hover, .option[data-active] { background: var(--neu-face-pressed); }
  .option .tick {
    margin-left: auto; flex-shrink: 0;
    width: 14px; height: 14px;
    color: var(--accent-glow); /* control value indicator — contract-legal */
    opacity: 0;
    transition: opacity var(--duration-fast) var(--ease-out-soft);
  }
  .option[aria-selected="true"] .tick { opacity: 1; }
`;

export class AxSelect extends FormControlMixin(BaseComponent) {
  static observedAttributes = ['value', 'label', 'placeholder', 'disabled', 'required', 'options'];

  constructor() {
    super();
    this.addStyles(CSS);
    this._options = [];
    this._active = 0;
    this._onDocPointerDown = (e) => {
      if (e.composedPath().includes(this)) return;
      this._close(false);
    };
  }

  get options() { return this._options; }
  set options(list) {
    this._propSet = true; // explicit property assignment permanently wins over the attribute
    this._options = Array.isArray(list) ? list : [];
    if (this._trigger) this._renderOptions();
  }

  get value() { return this.getAttribute('value') || ''; }
  set value(v) { this.setAttribute('value', v ?? ''); }

  attributeChangedCallback(name) {
    if (!this._trigger) return;
    if (name === 'options') { if (!this._propSet) this._parseAttr(); }
    else this._sync();
  }

  _parseAttr() {
    try {
      const parsed = JSON.parse(this.getAttribute('options') || '[]');
      this._options = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      this._options = [];
      log.warn('[ax-select] Bad options JSON', e);
    }
    this._renderOptions();
  }

  render() {
    const id = `s-${Math.random().toString(36).slice(2, 9)}`;
    this._id = id;
    this.shadowRoot.innerHTML = `
      <label class="control-label" id="${id}-label"></label>
      <div class="anchor">
        <div class="well" part="well">
          <button type="button" class="trigger" part="trigger" role="combobox"
            aria-haspopup="listbox" aria-expanded="false"
            aria-controls="${id}-menu"
            aria-labelledby="${id}-label ${id}-value"
            aria-describedby="${id}-msg">
            <span class="sel" id="${id}-value"></span>
            <svg class="chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
        </div>
        <ul class="menu" role="listbox" id="${id}-menu" aria-labelledby="${id}-label"></ul>
      </div>
      <p class="msg" id="${id}-msg" aria-live="polite"></p>`;
    this._trigger = this.shadowRoot.querySelector('.trigger');
    this._menu = this.shadowRoot.querySelector('.menu');
    this._msg = this.shadowRoot.querySelector('.msg');
    this._touched = false;
    this._defaultValue = this.getAttribute('value'); // for form reset

    this._trigger.addEventListener('click', () => {
      this.hasAttribute('open') ? this._close() : this._open();
    });
    this._trigger.addEventListener('keydown', e => this._onKeydown(e));
    // Keep focus ON the trigger while clicking options (listbox convention);
    // this also keeps :focus-within chrome stable during mouse selection.
    this._menu.addEventListener('pointerdown', e => e.preventDefault());
    this._menu.addEventListener('click', e => {
      const li = e.target.closest('.option');
      if (li) this._select(Number(li.dataset.i));
    });
    // Touched when focus truly leaves the component (not trigger→menu hops).
    this.addEventListener('focusout', () => {
      queueMicrotask(() => {
        if (this.matches(':focus-within')) return;
        if (this.hasAttribute('open')) this._close(false);
        this._touched = true;
        this._syncValidity();
      });
    });

    if (this._propSet) this._renderOptions();
    else this._parseAttr();
  }

  _onKeydown(e) {
    const open = this.hasAttribute('open');
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        this._open();
      }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); this._setActive(this._active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this._setActive(this._active - 1); }
    else if (e.key === 'Home') { e.preventDefault(); this._setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); this._setActive(this._options.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._select(this._active); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this._close(); }
    else if (e.key === 'Tab') { this._close(false); }
    else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) { this._typeahead(e.key); }
  }

  _typeahead(char) {
    clearTimeout(this._taTimer);
    this._taBuf = (this._taBuf || '') + char.toLowerCase();
    this._taTimer = setTimeout(() => { this._taBuf = ''; }, TYPEAHEAD_RESET_MS);
    const i = this._options.findIndex(o =>
      String(o.label ?? o.value).toLowerCase().startsWith(this._taBuf));
    if (i !== -1) this._setActive(i);
  }

  _open() {
    if (this.hasAttribute('open') || this._trigger.disabled) return;
    this.setAttribute('open', '');
    this._trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', this._onDocPointerDown, true);
    const sel = this._options.findIndex(o => String(o.value) === this.value);
    this._setActive(sel === -1 ? 0 : sel);
    requestAnimationFrame(() => {
      // Flip up when there is less room below the well than the menu needs
      // (ax-popover flip precedent; shadow-internal, so no !important dance).
      const wellRect = this.shadowRoot.querySelector('.well').getBoundingClientRect();
      const menuH = this._menu.offsetHeight;
      const below = window.innerHeight - wellRect.bottom;
      if (below < menuH + 16 && wellRect.top > menuH + 16) this.setAttribute('data-flip', '');
    });
  }

  _close(refocus = true) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.removeAttribute('data-flip');
    this._trigger.setAttribute('aria-expanded', 'false');
    this._trigger.removeAttribute('aria-activedescendant');
    document.removeEventListener('pointerdown', this._onDocPointerDown, true);
    this._touched = true;
    this._syncValidity();
    if (refocus) this._trigger.focus();
  }

  _select(i) {
    const o = this._options[i];
    if (!o) return;
    const next = String(o.value);
    const changed = next !== this.value;
    this.setAttribute('value', next);
    this._close();
    if (changed) {
      this.dispatchEvent(new CustomEvent('change', {
        bubbles: true, composed: true,
        detail: { value: next, label: String(o.label ?? o.value) }
      }));
    }
  }

  _setActive(i) {
    const n = this._options.length;
    if (!n) return;
    this._active = Math.max(0, Math.min(n - 1, i));
    this._menu.querySelectorAll('.option').forEach((el, j) => {
      if (j === this._active) el.setAttribute('data-active', '');
      else el.removeAttribute('data-active');
    });
    this._trigger.setAttribute('aria-activedescendant', `${this._id}-opt-${this._active}`);
    this._menu.children[this._active]?.scrollIntoView({ block: 'nearest' });
  }

  _renderOptions() {
    this._menu.innerHTML = this._options.map((o, i) => `
      <li class="option" id="${this._id}-opt-${i}" role="option" data-i="${i}">
        <span>${this._esc(o.label ?? o.value)}</span>
        <svg class="tick" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </li>`).join('');
    this._sync();
  }

  _sync() {
    this.shadowRoot.querySelector('.control-label').textContent = this.getAttribute('label') || '';
    this._trigger.disabled = this.hasAttribute('disabled') || this.hasAttribute('data-form-disabled');
    const selected = this._options.find(o => String(o.value) === this.value);
    const sel = this.shadowRoot.querySelector('.sel');
    sel.textContent = selected ? String(selected.label ?? selected.value)
      : (this.getAttribute('placeholder') || 'Select…');
    sel.classList.toggle('placeholder', !selected);
    this._menu.querySelectorAll('.option').forEach((el, i) => {
      el.setAttribute('aria-selected', String(String(this._options[i].value) === this.value));
    });
    this._syncValidity();
  }

  _syncValidity() {
    const selected = this._options.some(o => String(o.value) === this.value);
    this._setFormValue(selected ? this.value : null);
    if (this.hasAttribute('required') && !selected) {
      this._internals.setValidity({ valueMissing: true }, 'Please select an option', this._trigger);
    } else {
      this._internals.setValidity({});
    }
    const show = this._touched && this.hasAttribute('required') && !selected;
    this.toggleAttribute('data-invalid', show);
    this._msg.textContent = show ? 'Please select an option' : '';
  }

  reportValidity() {
    this._touched = true;
    this._syncValidity();
    return !this.hasAttribute('data-invalid');
  }

  _formReset() {
    if (this._defaultValue === null) this.removeAttribute('value');
    else this.setAttribute('value', this._defaultValue);
    this._touched = false;
    this._sync();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this._taTimer);
    document.removeEventListener('pointerdown', this._onDocPointerDown, true);
  }
}

customElements.define('ax-select', AxSelect);
