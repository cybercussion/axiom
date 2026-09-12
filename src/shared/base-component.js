/**
 * Project Axiom: BaseComponent
 * The immutable blueprint for all feature "limbs."
 */
import { state } from '@state';
import { log } from '@core/logger.js';

const themeSheet = new CSSStyleSheet();
const themeUrl = new URL('./styles/theme.css', import.meta.url);
const HOST_DEFAULTS = ':host { display: block; contain: none; }'; // after the theme, so it wins

// The theme has to reach every shadow root, which a document <link> cannot do,
// so its rules are copied into one constructed sheet that every component adopts.
//
// First choice: the page's own <link> to theme.css. Module scripts do not run
// until the head's stylesheets have loaded, so when index.html links the theme
// its rules are parsed before any component connects — the sheet fills
// synchronously, at no second request.
//
// Otherwise (no link, or one this origin may not read) the theme is fetched and
// components wait for it before rendering. Rendering into the still-empty sheet
// painted shadow roots unstyled — a custom element is display:inline until
// `:host` says otherwise — and the restyle when it landed moved the page: CLS
// 0.19 on /components with the fetch held 900 ms.
let themeLoaded = false;
const fillTheme = (css) => {
  themeSheet.replaceSync(`${css}\n${HOST_DEFAULTS}`);
  // Empty text is not a theme. Leave `themeLoaded` false so a component still waits
  // for the fetch rather than rendering against nothing but the :host defaults.
  themeLoaded = Boolean(css);
};
const linkedTheme = () => {
  for (const sheet of document.styleSheets ?? []) {
    try {
      if (sheet.href && new URL(sheet.href).pathname === themeUrl.pathname) {
        // A matched sheet with NO rules is not an answer: it is a sheet that has not
        // parsed yet (a link the parser had not reached, or one that is not
        // script-blocking). Returning its empty serialization would install a theme
        // of nothing and suppress the fetch that would have worked.
        if (sheet.cssRules.length === 0) return null;
        return [...sheet.cssRules].map((rule) => rule.cssText).join('\n');
      }
    } catch { /* a sheet this origin may not read: fall back to fetching */ }
  }
  return null;
};
const linked = linkedTheme();
if (linked !== null) fillTheme(linked);
const themeReady = themeLoaded ? Promise.resolve() : (async () => {
  try {
    const res = await fetch(themeUrl.href);
    fillTheme(await res.text());
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
    /** @type {Promise<void>} Resolves after the first render; the router awaits it. */
    this.rendered = new Promise(resolve => {
      this._resolveRendered = resolve;
    });
  }

  /**
   * AOM: ID Bridge Pattern
   * Generates a unique ID for the internal element and sets
   * aria-labelledby on the host if needed.
   * @param {Element|null} internalRef
   * @param {string} [suffix]
   * @returns {string}
   */
  bridgeID(internalRef, suffix = 'label') {
    const id = `${this.tagName.toLowerCase()}-${suffix}-${Math.random().toString(36).substr(2, 9)}`;
    if (internalRef) internalRef.id = id;
    return id;
  }

  /**
   * Escape text for interpolation into innerHTML templates.
   * @param {unknown} str
   * @returns {string}
   */
  _esc(str) {
    return String(str ?? '').replace(/[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /**
   * Surgical Ref: Returns a cached node or finds it once.
   * @param {string} name
   * @param {string} selector
   * @returns {Element|null}
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
   * @param {string} cssString
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
  /** @param {string} url @returns {Promise<void>} */
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

    // Failure containment. A component that throws in setup(), render() or
    // onRendered() must not hang the navigation waiting on it, nor take anything
    // else down. Its failure is announced as a bubbling, composed, cancelable
    // `axiom:component-error`: any ancestor is a boundary — preventDefault() and
    // the fallback is yours. Unhandled, the component draws a notice inside its
    // own shadow root. Either way `rendered` resolves, so the router commits.
    // Never render into an empty theme sheet (see themeReady). When the page links
    // the theme it is already full and the lifecycle stays synchronous; only a
    // page that has to fetch it waits here.
    if (!themeLoaded) await themeReady;

    let phase = 'setup';
    try {
      if (this.setup) await this.setup();
      phase = 'render';
      this.render();
      phase = 'onRendered';
      if (this.onRendered) await this.onRendered();
    } catch (error) {
      this._contain(error, phase);
    } finally {
      // Signal to the router that the house is built — or safely condemned.
      this._resolveRendered();
    }
  }

  /** @internal Announce a failure; draw the fallback unless an ancestor took it. */
  _contain(error, phase) {
    const component = this.tagName.toLowerCase();
    log.error(`Axiom Component Error [${component} · ${phase}]`, error);
    const handled = !this.dispatchEvent(new CustomEvent('axiom:component-error', {
      bubbles: true, composed: true, cancelable: true,
      detail: { error, phase, component }
    }));
    if (handled) return;
    const notice = document.createElement('div');
    notice.className = 'axiom-component-error';
    notice.setAttribute('role', 'alert');
    notice.textContent = 'This part of the page failed to load.';
    this.shadowRoot.replaceChildren(notice);
  }

  /**
   * Universal Subscription Helper
   * Automatically handles cleanup when the component disconnects.
   * @param {string} targetKey - The state key to watch
   * @param {(value: any) => void} callback - Function to run on update
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
