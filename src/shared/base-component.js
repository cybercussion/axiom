/**
 * Project Axiom: BaseComponent
 * The immutable blueprint for all feature "limbs."
 */
import { state } from '@state';
import { log } from '@core/logger.js';

const themeSheet = new CSSStyleSheet();

// Fetch the shared theme and populate the sheet so it pierces Shadow DOM
(async () => {
  try {
    const themeUrl = new URL('./styles/theme.css', import.meta.url).href;
    const res = await fetch(themeUrl);
    const css = await res.text();
    themeSheet.replaceSync(`
      ${css}
      /* Ensure host display is set, overriding if needed */
      :host { display: block; contain: none; }
    `);
  } catch (e) {
    log.error('[BaseComponent] Failed to load theme.css', e);
  }
})();

// ============ INPUT-MODALITY TRACKER ============
// One document-level listener pair; the current modality is mirrored as a
// data-modality attribute on every mounted component so shadow CSS (via the
// adopted theme sheet) can suppress pointer-origin focus rings UNIVERSALLY.
// Keyboard users keep rings: any non-modifier keypress flips back instantly.
const mountedComponents = new Set();
let inputModality = 'keyboard';
const setModality = m => {
  if (m === inputModality) return;
  inputModality = m;
  for (const el of mountedComponents) el.setAttribute('data-modality', m);
};
window.addEventListener('pointerdown', () => setModality('pointer'), true);
// Manipulation keys ADJUST the focused control (arrowing a slider you just
// clicked); they are not navigation, so they don't flip a pointer session
// into keyboard modality (which would surprise-paint focus rings mid-drag).
// Tab/typing/activation keys still flip, so keyboard-first users — who
// arrive at controls via Tab — keep every ring.
const MANIPULATION_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'
]);
window.addEventListener('keydown', e => {
  if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
  // Shortcut CHORDS are not typing: the Tab inside Cmd+Tab (app switch) must
  // not flip to keyboard modality — Chrome re-matches :focus-visible when the
  // window regains focus, so that stray flip painted a ring on the control
  // you'd been dragging every time you switched apps and back.
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (MANIPULATION_KEYS.has(e.key) && inputModality === 'pointer') return;
  setModality('keyboard');
}, true);

export class BaseComponent extends HTMLElement {
  /** Shared constructed-sheet cache for addStyles() — keyed by CSS text. */
  static _sheetCache = new Map();

  constructor() {
    super();
    // AOM: delegatesFocus ensures keyboard users don't get trapped on the host.
    // However, it can cause "snap to top" on click for large components.
    // We allow opting out via static property.
    const delegatesFocus = this.constructor.delegatesFocus !== false;
    this.attachShadow({ mode: 'open', delegatesFocus });
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
   * Escape text for interpolation into innerHTML templates.
   */
  _esc(str) {
    return String(str ?? '').replace(/[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
   * Sheets are memoized by CSS text: every control class passes the same
   * module-level constant, so N instances share ONE constructed sheet
   * instead of paying N parses (the same pattern as themeSheet above).
   */
  addStyles(cssString) {
    let sheet = BaseComponent._sheetCache.get(cssString);
    if (!sheet) {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(cssString);
      BaseComponent._sheetCache.set(cssString, sheet);
    }
    this.shadowRoot.adoptedStyleSheets = [...this.shadowRoot.adoptedStyleSheets, sheet];
  }

  /**
   * Fetches external CSS and adopts it.
   * Workaround for lack of import ... with { type: 'css' } support.
   */
  async addExternalStyles(url) {
    // Dedup: don't re-add the same stylesheet on re-mount
    if (!this._loadedStyleUrls) this._loadedStyleUrls = new Set();
    if (this._loadedStyleUrls.has(url)) return;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const cssText = await response.text();
      const sheet = new CSSStyleSheet();

      // Use replaceSync for immediate application
      sheet.replaceSync(cssText);

      this.shadowRoot.adoptedStyleSheets = [...this.shadowRoot.adoptedStyleSheets, sheet];
      this._loadedStyleUrls.add(url);
    } catch (err) {
      log.error(`Style Error: ${url}`, err);
    }
  }

  // Lifecycle managed by the limb, not the brain
  //connectedCallback() { this.render(); }
  //disconnectedCallback() { }
  //render() { this.shadowRoot.innerHTML = '<slot></slot>'; }
  // The "Brain" version of connectedCallback
  async connectedCallback() {
    mountedComponents.add(this);
    this.setAttribute('data-modality', inputModality);
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
    mountedComponents.delete(this);
    if (this._themeCleanup) this._themeCleanup();
    if (this._unsubscribers) {
      this._unsubscribers.forEach(unsub => unsub());
    }
  }

  render() {
    this.shadowRoot.innerHTML = '<slot></slot>';
  }
}
