/**
 * Test setup — makes src/ ES modules loadable under Node.
 *
 * src/ imports the bare specifiers declared in index.html's importmap
 * (@state, @core/, @shared/, @features/). Node does not read that map, so a
 * plain `import { state } from '@state'` dies with ERR_MODULE_NOT_FOUND. That
 * single gap is why the browser core had no tests while tools/ did.
 *
 * Register a resolve hook applying the SAME mapping, so a test imports exactly
 * what the browser imports: no build step, no shim layer, no second module
 * graph that can drift from the shipped one.
 *
 * Also installs the handful of browser globals the core touches at MODULE-EVAL
 * time (config.js reads location + window.AXIOM_CONFIG; state.js reads
 * localStorage for theme/audio/captions/session). They must exist BEFORE the
 * first src/ import, which is why this file is loaded with --import rather
 * than imported from a test.
 */
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { installDom } from './dom.js';

// Derived, never hard-coded: an absolute machine-local path must not ship.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Mirrors the "imports" block of index.html's <script type="importmap">.
// KEEP IN SYNC: a specifier that resolves in the browser must resolve here.
const IMPORT_MAP = {
  '@state': join(ROOT, 'src/core/state.js'),
  '@core/': join(ROOT, 'src/core/'),
  '@shared/': join(ROOT, 'src/shared/'),
  '@features/': join(ROOT, 'src/features/'),
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    const exact = IMPORT_MAP[specifier];
    if (exact) return { url: pathToFileURL(exact).href, shortCircuit: true };

    for (const [prefix, target] of Object.entries(IMPORT_MAP)) {
      if (prefix.endsWith('/') && specifier.startsWith(prefix)) {
        const full = target + specifier.slice(prefix.length);
        return { url: pathToFileURL(full).href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});

/** Web Storage stand-in: same surface, no persistence. */
const makeStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(String(k)) ? map.get(String(k)) : null),
    setItem: (k, v) => { map.set(String(k), String(v)); },
    removeItem: (k) => { map.delete(String(k)); },
    clear: () => { map.clear(); },
    key: (i) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  };
};

globalThis.localStorage ??= makeStorage();
globalThis.sessionStorage ??= makeStorage();
globalThis.location ??= {
  hostname: 'localhost',
  pathname: '/',
  href: 'http://localhost/',
  origin: 'http://localhost',
  search: '',
};
installDom();
