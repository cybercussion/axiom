/**
 * Project Axiom: Announcer
 * A polite ARIA live region for screen-reader announcements.
 *
 * Reconciled from the fleet's shared/announce-bus.js — byte-identical in tender,
 * scobot and new.cybercussion.com, and imported by none of them, so nothing was
 * ever announced. Core owns it now because the router uses it: every route change
 * after the first is announced by the new page's title. It reuses
 * #a11y-announcer when the page declares one, so there is one live region.
 */

function ensureLiveRegion(root, id) {
  if (!root) return null;

  let region = root.getElementById?.(id) || root.querySelector?.(`#${id}`);
  if (region) return region;

  region = document.createElement('div');
  region.id = id;
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  Object.assign(region.style, {
    position: 'absolute', width: '1px', height: '1px', padding: '0', margin: '-1px',
    overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: '0'
  });

  root.appendChild?.(region);
  return region;
}

/** The fleet's announce-bus API, unchanged — existing callers keep working. */
export class AnnounceBus {
  /** @param {{ root?: ParentNode, regionId?: string }} [options] */
  constructor({ root = document.body, regionId = 'axiom-live-region' } = {}) {
    this.root = root;
    this.regionId = regionId;
    this.region = ensureLiveRegion(root, regionId);
  }

  /** @param {string} text */
  announce(text) {
    if (!this.region || !text) return;
    // Clear, then set on the next frame: a message identical to the last one
    // would otherwise not be announced again.
    this.region.textContent = '';
    requestAnimationFrame(() => {
      this.region.textContent = String(text);
    });
  }

  /** @param {string} label @param {number} position @param {number} total */
  announceMove(label, position, total) {
    this.announce(`Moved ${label} to position ${position} of ${total}.`);
  }

  /** @param {string} label @param {boolean} selected */
  announceSelection(label, selected) {
    this.announce(`${label} ${selected ? 'selected' : 'deselected'}.`);
  }

  /** @param {string} text */
  announceState(text) {
    this.announce(text);
  }
}

let shared = null;

/**
 * Announce text politely through the page's announcer.
 * @param {string} text
 */
export const announce = (text) => {
  shared ??= new AnnounceBus({ regionId: 'a11y-announcer' });
  shared.announce(text);
};
