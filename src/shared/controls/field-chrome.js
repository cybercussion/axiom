/**
 * FIELD_CHROME_CSS — shared label/well/message chrome for ax-field,
 * ax-textarea, ax-select. The base look mirrors theme.css's global inputs
 * (shadow fields match light-DOM forms pixel-for-pixel); surface="neu"
 * carves the well. The focus ring is focus-within chrome ON PURPOSE:
 * text entry shows its ring for pointer focus too (caret needs visible
 * context) — this is outside the data-modality :focus-visible system.
 */
export const FIELD_CHROME_CSS = `
  :host { display: block; }
  :host([disabled]) .well, :host([data-form-disabled]) .well,
  :host([disabled]) .control-label, :host([data-form-disabled]) .control-label {
    opacity: 0.45;
  }
  :host([disabled]) .well, :host([data-form-disabled]) .well { pointer-events: none; }
  .control-label {
    display: block;
    font-size: var(--text-sm); font-weight: 600;
    color: var(--color-muted);
    margin-bottom: var(--space-xs);
    letter-spacing: 0.05em; text-transform: uppercase;
  }
  .control-label:empty { display: none; }
  .well {
    display: flex; align-items: center; gap: var(--space-xs);
    width: 100%; box-sizing: border-box;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: 12px;
    padding: 0 var(--space-m);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
    transition:
      background var(--duration-base) var(--ease-out-soft),
      border-color var(--duration-base) var(--ease-out-soft),
      box-shadow var(--duration-base) var(--ease-out-soft);
  }
  .well:focus-within {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--color-primary);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 0 4px rgba(59, 130, 246, 0.1);
  }
  :host([data-invalid]) .well { border-color: var(--danger-color); }
  :host([data-invalid]) .well:focus-within {
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1),
      0 0 0 4px color-mix(in srgb, var(--danger-color) 15%, transparent);
  }
  .msg {
    min-height: 1.25em;
    margin: var(--space-2xs) 0 0;
    font-size: var(--text-sm);
    color: var(--danger-color);
  }
  /* ===== surface="neu" — carved well ===== */
  :host([surface="neu"]) .well {
    background: var(--neu-surface-deep);
    border: none;
    box-shadow: var(--neu-well);
  }
  :host([surface="neu"]) .well:focus-within {
    box-shadow: var(--neu-well), 0 0 0 1px var(--color-primary);
  }
  :host([surface="neu"][data-invalid]) .well {
    box-shadow: var(--neu-well), 0 0 0 1px var(--danger-color);
  }
`;
