/**
 * Project Axiom: BaseComponent
 * The immutable blueprint for all feature "limbs."
 */
import { state } from '@state';

const themeSheet = new CSSStyleSheet();

// Fetch the shared theme and populate the sheet so it pierces Shadow DOM
(async () => {
  try {
    const res = await fetch('src/shared/styles/theme.css');
    const css = await res.text();
    themeSheet.replaceSync(`
      ${css}
      /* Ensure host display is set, overriding if needed */
      :host { display: block; contain: none; }
    `);
  } catch (e) {
    console.error('[BaseComponent] Failed to load theme.css', e);
  }
})();

export class BaseComponent extends HTMLElement {
  constructor() {
    super();
    // AOM: delegatesFocus ensures keyboard users don't get trapped on the host
    this.attachShadow({ mode: 'open', delegatesFocus: true });
    this._refs = new Map();
    // Adopt the shared theme immediately
    this.shadowRoot.adoptedStyleSheets = [themeSheet];

    // Create a deferred promise for the router to wait on
    this.rendered = new Promise(resolve => {
      this._resolveRendered = resolve;
    });
  }

  /**
   * AOM: ID Bridge Pattern
   * Generates a unique ID for the internal element and sets 
   * aria-labelledby on the host if needed.
   */
  bridgeID(internalRef, suffix = 'label') {
    const id = `${this.tagName.toLowerCase()}-${suffix}-${Math.random().toString(36).substr(2, 9)}`;
    if (internalRef) internalRef.id = id;
    return id;
  }

  /**
   * Surgical Ref: Returns a cached node or finds it once.
   */
  ref(name, selector) {
    let el = this._refs.get(name);
    if (!el) {
      el = this.shadowRoot.querySelector(selector);
      if (el) this._refs.set(name, el);
    }
    return el;
  }

  /**
   * Dynamic Style Adoption: Allows features to add their own encapsulated styles
   * without affecting the global theme.
   */
  addStyles(cssString) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(cssString);
    this.shadowRoot.adoptedStyleSheets = [...this.shadowRoot.adoptedStyleSheets, sheet];
  }

  /**
   * Fetches external CSS and adopts it.
   * Workaround for lack of import ... with { type: 'css' } support.
   */
  async addExternalStyles(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const cssText = await response.text();
      const sheet = new CSSStyleSheet();

      // Use replaceSync for immediate application
      sheet.replaceSync(cssText);

      this.shadowRoot.adoptedStyleSheets = [...this.shadowRoot.adoptedStyleSheets, sheet];
    } catch (err) {
      console.error(`Style Error: ${url}`, err);
    }
  }

  // Lifecycle managed by the limb, not the brain
  //connectedCallback() { this.render(); }
  //disconnectedCallback() { }
  //render() { this.shadowRoot.innerHTML = '<slot></slot>'; }
  // The "Brain" version of connectedCallback
  async connectedCallback() {
    // Sync theme
    const applyTheme = (val) => this.setAttribute('data-theme', val);
    applyTheme(state.get('theme'));

    this._themeCleanup = state.subscribe(({ key, value }) => {
      if (key === 'theme') applyTheme(value);
    });

    // If the child (HomeUI) has a setup phase, wait for it
    if (this.setup) await this.setup();
    this.render();
    if (this.onRendered) await this.onRendered();

    // Signal to the router that the house is built
    this._resolveRendered();
  }

  /**
   * Universal Subscription Helper
   * Automatically handles cleanup when the component disconnects.
   * @param {string} targetKey - The state key to watch
   * @param {function} callback - Function to run on update
   */
  subscribe(targetKey, callback) {
    const unsub = state.subscribe(({ key, value }) => {
      if (key === targetKey) callback(value);
    });

    // Auto-cleanup tracking
    if (!this._unsubscribers) this._unsubscribers = [];
    this._unsubscribers.push(unsub);
  }

  disconnectedCallback() {
    if (this._themeCleanup) this._themeCleanup();
    if (this._unsubscribers) {
      this._unsubscribers.forEach(unsub => unsub());
    }
  }

  render() {
    this.shadowRoot.innerHTML = '<slot></slot>';
  }
}
