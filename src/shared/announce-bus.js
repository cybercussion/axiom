/**
 * Project Axiom: Announce Bus
 * ARIA live region manager for screen reader announcements.
 * Creates a visually-hidden live region and provides helpers
 * for common announcement patterns.
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
  region.style.position = 'absolute';
  region.style.width = '1px';
  region.style.height = '1px';
  region.style.padding = '0';
  region.style.margin = '-1px';
  region.style.overflow = 'hidden';
  region.style.clip = 'rect(0, 0, 0, 0)';
  region.style.whiteSpace = 'nowrap';
  region.style.border = '0';

  if (root.appendChild) root.appendChild(region);
  return region;
}

export class AnnounceBus {
  constructor({ root = document.body, regionId = 'axiom-live-region' } = {}) {
    this.root = root;
    this.regionId = regionId;
    this.region = ensureLiveRegion(root, regionId);
  }

  announce(text) {
    if (!this.region || !text) return;

    this.region.textContent = '';
    requestAnimationFrame(() => {
      this.region.textContent = String(text);
    });
  }

  announceMove(label, position, total) {
    this.announce(`Moved ${label} to position ${position} of ${total}.`);
  }

  announceSelection(label, selected) {
    this.announce(`${label} ${selected ? 'selected' : 'deselected'}.`);
  }

  announceState(text) {
    this.announce(text);
  }
}
