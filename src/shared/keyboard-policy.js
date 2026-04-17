/**
 * Project Axiom: Keyboard Policy
 * Centralizes key-to-action mapping for accessible components.
 * Supports roving focus mode (arrow keys) and standard actions.
 */

export class KeyboardPolicy {
  resolveAction(event, context = {}) {
    const key = event?.key;
    if (!key) return null;

    if (key === 'Escape') return { type: 'cancel' };
    if (key === 'Home') return { type: 'jump-first' };
    if (key === 'End') return { type: 'jump-last' };
    if (key === 'Enter' || key === ' ') return { type: 'activate' };

    if (context?.roving && (key === 'ArrowUp' || key === 'ArrowLeft')) {
      return { type: 'move-prev' };
    }

    if (context?.roving && (key === 'ArrowDown' || key === 'ArrowRight')) {
      return { type: 'move-next' };
    }

    return null;
  }

  applyAction(action, adapter) {
    if (!action || !adapter || typeof adapter.perform !== 'function') return false;
    return adapter.perform(action.type, action.payload);
  }
}
