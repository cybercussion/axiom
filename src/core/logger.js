/**
 * Logger
 * Centralized logging with severity levels and environment-based filtering.
 * Uses CSS styling for better readability in the console.
 */
import { config } from '@core/config.js';

// Define the levels once
const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const THRESHOLD = config.ENV === 'production' ? LEVELS.WARN : LEVELS.DEBUG;

const print = (level, label, color, msg, args) => {
  if (level < THRESHOLD) return;
  // Unified Prefix: All logs now start with [Axiom::LABEL]
  console.log(
    `%c[Axiom::${label}] %c${msg}`,
    `color: ${color}; font-weight: bold;`,
    'color: inherit;',
    ...args
  );
};

export const log = {
  debug: (msg, ...args) => print(LEVELS.DEBUG, 'DEBUG', '#7dd3fc', msg, args),
  info: (msg, ...args) => print(LEVELS.INFO, 'INFO', '#86efac', msg, args),
  warn: (msg, ...args) => print(LEVELS.WARN, 'WARN', '#fde047', msg, args),
  error: (msg, ...args) => print(LEVELS.ERROR, 'ERROR', '#fca5a5', msg, args)
};
