/**
 * Project Axiom: Focus Walker
 *
 * Manages sequential Tab navigation across Shadow DOM boundaries.
 * Safari doesn't natively handle Tab order through nested shadow roots,
 * so this module walks the full composed tree and steps programmatically.
 *
 * Usage: import '@core/focus-walker.js' — self-installs on load.
 */

const TABBABLE = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

function isTabbable(el) {
  if (!(el instanceof HTMLElement)) return false;
  if (!el.matches(TABBABLE)) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  const s = getComputedStyle(el);
  if (s.display === 'none' || s.visibility === 'hidden') return false;
  // Skip zero-size elements (off-screen honeypots, collapsed containers)
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/** Depth-first walk of the composed DOM tree, producing tab order. */
function getTabOrder() {
  const result = [];

  function walk(node) {
    if (!node) return;

    // Slots: walk distributed (assigned) content
    if (node instanceof HTMLSlotElement) {
      const assigned = node.assignedNodes({ flatten: true });
      for (const n of assigned) {
        if (n.nodeType === Node.ELEMENT_NODE) walk(n);
      }
      return;
    }

    // Check tabbability
    if (node instanceof HTMLElement && isTabbable(node)) {
      result.push(node);
    }

    // Shadow host: walk shadow tree (slots inside pull in light DOM)
    if (node.shadowRoot) {
      for (const child of node.shadowRoot.children) walk(child);
      return;
    }

    // Regular children
    if (node.children) {
      for (const child of node.children) walk(child);
    }
  }

  walk(document.body);
  return result;
}

function getDeepActiveElement() {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

/** Track last focused element so we can recover if activeElement chain breaks */
let _lastFocused = null;

function onTab(e) {
  if (e.key !== 'Tab' || e.defaultPrevented) return;

  const order = getTabOrder();
  if (!order.length) return;

  const active = getDeepActiveElement();
  let idx = order.indexOf(active);

  // Safari + delegatesFocus can lose track of the deep active element.
  // Fall back to our last-known focused element.
  if (idx === -1 && _lastFocused && order.includes(_lastFocused)) {
    idx = order.indexOf(_lastFocused);
  }

  // Still unknown — start from the edge
  if (idx === -1) {
    idx = e.shiftKey ? 0 : order.length - 1;
  }

  const next = e.shiftKey
    ? (idx === 0 ? order[order.length - 1] : order[idx - 1])
    : (idx === order.length - 1 ? order[0] : order[idx + 1]);

  if (next) {
    e.preventDefault();
    next.focus();
    _lastFocused = next;
  }
}

// Self-install
document.addEventListener('keydown', onTab, true);

export { getTabOrder, getDeepActiveElement };
