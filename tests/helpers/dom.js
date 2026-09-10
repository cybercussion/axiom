/**
 * A deliberately tiny DOM — enough for code paths that BUILD elements.
 *
 * This is NOT a DOM implementation and must not grow into one. It exists so a
 * unit test can assert WHERE a module renders and WHAT it renders, without a
 * headless browser or a jsdom dependency (this project ships no runtime deps
 * and should not acquire heavy dev ones for one assertion).
 *
 * If a test needs layout, bubbling, selectors or real event dispatch on
 * elements, that test belongs in a browser. Reach for Playwright, not for more
 * stub surface here.
 */

/** An element that records what was put in it. */
export const makeElement = (tag = 'div') => ({
  tagName: String(tag).toUpperCase(),
  className: '',
  textContent: '',
  children: [],
  attributes: Object.create(null),
  setAttribute(name, value) { this.attributes[name] = String(value); },
  getAttribute(name) { return this.attributes[name] ?? null; },
  append(...nodes) { this.children.push(...nodes); },
  replaceChildren(...nodes) { this.children = [...nodes]; },
});

const byId = new Map();

/** Make `document.getElementById(id)` resolve to `el` for the next test. */
export const registerElement = (id, el) => { byId.set(id, el); return el; };

/** Drop every registered element — call between tests. */
export const resetDom = () => {
  byId.clear();
  if (globalThis.document) globalThis.document.body = makeElement('body');
};

/** Install the stub globals. Idempotent; safe to call from setup only. */
export const installDom = () => {
  globalThis.document ??= {
    baseURI: 'http://localhost/',
    body: makeElement('body'),
    createElement: (tag) => makeElement(tag),
    getElementById: (id) => byId.get(id) ?? null,
  };

  // window must be a real EventTarget: the router signals terminal failures by
  // dispatching a cancelable event on it, and preventDefault() is the contract.
  if (!globalThis.window) {
    const win = new EventTarget();
    win.scrollTo = () => {};
    // AXIOM_CONFIG intentionally absent — that is the "no injected runtime
    // config" case config.js is meant to fall through.
    globalThis.window = win;
  }
};
