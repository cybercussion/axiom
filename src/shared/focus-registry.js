/**
 * Project Axiom: Focus Registry
 * Manages focus "surfaces" — distinct interactive areas with their own focus maps.
 * Supports semantic node IDs so focus persists across DOM rebuilds,
 * snapshot/restore for maintaining focus across re-renders,
 * and deep Shadow DOM traversal.
 */

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]:not([aria-disabled="true"])',
  '[role="link"]:not([aria-disabled="true"])',
  '[role="checkbox"]:not([aria-disabled="true"])',
  '[role="radio"]:not([aria-disabled="true"])'
].join(', ');

function isElementVisible(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isElementFocusable(element) {
  if (!(element instanceof HTMLElement || element instanceof SVGElement)) return false;
  if (element instanceof HTMLElement && element.disabled) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;
  return isElementVisible(element);
}

function queryFocusable(root) {
  if (!root?.querySelectorAll) return [];
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isElementFocusable);
}

function queryDeepFocusable(root) {
  const results = [];
  const visited = new Set();

  const visit = (scope) => {
    if (!scope || visited.has(scope)) return;
    visited.add(scope);

    const localFocusable = queryFocusable(scope);
    for (const node of localFocusable) {
      if (!results.includes(node)) results.push(node);
    }

    if (!scope.querySelectorAll) return;
    const hosts = scope.querySelectorAll('*');
    hosts.forEach((node) => {
      if (node.shadowRoot) visit(node.shadowRoot);
    });
  };

  visit(root);
  return results;
}

export class FocusRegistry {
  constructor() {
    this._surfaces = new Map();
  }

  registerSurface(surfaceId, root, options = {}) {
    if (!surfaceId) return;

    const existing = this._surfaces.get(surfaceId);
    const nodes = existing?.nodes || new Map();

    this._surfaces.set(surfaceId, {
      id: surfaceId,
      root,
      options,
      nodes,
      activeNodeId: existing?.activeNodeId || null,
      snapshot: existing?.snapshot || null
    });
  }

  unregisterSurface(surfaceId) {
    this._surfaces.delete(surfaceId);
  }

  clearSurfaceNodes(surfaceId) {
    const surface = this._surfaces.get(surfaceId);
    if (!surface) return;
    surface.nodes.clear();
  }

  registerNode(surfaceId, nodeId, resolver, meta = {}) {
    const surface = this._surfaces.get(surfaceId);
    if (!surface || !nodeId || typeof resolver !== 'function') return;

    surface.nodes.set(nodeId, {
      id: nodeId,
      resolver,
      meta
    });
  }

  setActive(surfaceId, nodeId) {
    const surface = this._surfaces.get(surfaceId);
    if (!surface) return;
    surface.activeNodeId = nodeId || null;
  }

  getTabOrder(surfaceId) {
    const surface = this._surfaces.get(surfaceId);
    if (!surface) return [];

    const entries = [];
    surface.nodes.forEach((node) => {
      const el = node.resolver();
      if (isElementFocusable(el)) {
        entries.push({
          nodeId: node.id,
          element: el,
          priority: Number(node.meta?.priority) || 0
        });
      }
    });

    return entries
      .sort((a, b) => a.priority - b.priority)
      .map((entry) => entry.nodeId);
  }

  focus({ surfaceId, nodeId }) {
    const surface = this._surfaces.get(surfaceId);
    if (!surface) return false;

    const node = surface.nodes.get(nodeId);
    if (!node) return false;

    const el = node.resolver();
    if (!isElementFocusable(el)) return false;

    if (typeof el.focus === 'function') {
      el.focus();
      surface.activeNodeId = nodeId;
      return true;
    }

    return false;
  }

  captureSnapshot(surfaceId) {
    const surface = this._surfaces.get(surfaceId);
    if (!surface) return null;

    const activeInDocument = document.activeElement;
    const activeInSurface = surface.root?.activeElement || activeInDocument;

    let matchedNodeId = null;
    for (const [nodeId, node] of surface.nodes.entries()) {
      const element = node.resolver();
      if (element && (element === activeInSurface || element.contains?.(activeInSurface))) {
        matchedNodeId = nodeId;
        break;
      }
    }

    surface.snapshot = {
      nodeId: matchedNodeId,
      activeNodeId: surface.activeNodeId,
      ts: Date.now()
    };

    return surface.snapshot;
  }

  restoreSnapshot(surfaceId) {
    const surface = this._surfaces.get(surfaceId);
    if (!surface) return false;

    const snapshot = surface.snapshot || {};

    // Build candidate list: snapshot targets first, then tab order
    const candidateNodeIds = [];
    if (snapshot.nodeId) candidateNodeIds.push(snapshot.nodeId);
    if (snapshot.activeNodeId && !candidateNodeIds.includes(snapshot.activeNodeId)) {
      candidateNodeIds.push(snapshot.activeNodeId);
    }

    for (const nodeId of this.getTabOrder(surfaceId)) {
      if (!candidateNodeIds.includes(nodeId)) candidateNodeIds.push(nodeId);
    }

    for (const nodeId of candidateNodeIds) {
      if (this.focus({ surfaceId, nodeId })) return true;
    }

    // Last resort: find any focusable element in the surface
    const fallback = this.findFirstFocusable(surfaceId, { deep: true });
    if (fallback) {
      fallback.focus();
      return true;
    }

    return false;
  }

  findFirstFocusable(surfaceId, { deep = false } = {}) {
    const surface = this._surfaces.get(surfaceId);
    if (!surface?.root) return null;

    const list = deep ? queryDeepFocusable(surface.root) : queryFocusable(surface.root);
    return list[0] || null;
  }
}
