/**
 * Project Axiom: runtime events — what the core did, for whoever is watching.
 *
 * The core narrates its own work as events on `window`: a navigation, a request,
 * an optimistic write, an auth transition. One name per kind, with a `phase`, and
 * every `start` ends exactly once, carrying the same id — so telemetry, a debug
 * panel or a test can pair them without guessing. Listen to the names you care
 * about, or hand observe() one function for all of them.
 *
 *   axiom:navigation  start → commit | abort | error     { navigationId, path, slug, ms, error }
 *   axiom:request     start → response | error | abort   { id, method, url, status, ms, error }
 *   axiom:mutation    start → success | rollback         { id, key, ms, error }
 *   axiom:auth        login | login-failed | refresh | refresh-failed | logout
 *   axiom:router-error, axiom:component-error — cancelable; see docs/contracts.md
 *
 * A detail never carries headers, bodies, payloads or tokens. A request's `url`
 * is the one fetched, query string included: scrub it before it leaves the page.
 */
import { log } from '@core/logger.js';

/** Every event the core dispatches on window. */
export const EVENTS = Object.freeze([
  'axiom:navigation', 'axiom:request', 'axiom:mutation', 'axiom:auth',
  'axiom:router-error', 'axiom:component-error',
]);

/**
 * Watch every runtime event with one function.
 * A handler that throws is logged, never thrown back into the runtime.
 * @param {(name: string, detail: Record<string, any>) => void} handler
 * @param {readonly string[]} [names] - defaults to EVENTS
 * @returns {() => void} stop watching
 */
export const observe = (handler, names = EVENTS) => {
  const listener = (e) => {
    try { handler(e.type, e.detail); } catch (err) { log.error(`observe(): a handler threw on ${e.type}`, err); }
  };
  for (const name of names) window.addEventListener(name, listener);
  return () => { for (const name of names) window.removeEventListener(name, listener); };
};

// The core's own voice, kept out of the public types. Function declarations,
// not arrow constants: only a declaration's JSDoc survives into the emitted .d.ts,
// where tools/types.js drops whatever is tagged @internal.

/**
 * @internal Dispatch one runtime event; never throws into its caller.
 * @param {string} name
 * @param {Record<string, any>} detail
 */
export function emit(name, detail) {
  try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (err) { log.warn(`could not dispatch ${name}`, err); }
}

let seq = 0;
/** @internal A correlation id and a start time, for a start/end pair. @returns {{ id: number, t0: number }} */
export function begin() { return { id: ++seq, t0: performance.now() }; }
/** @internal Milliseconds since `t0`, to a tenth. @param {number} t0 @returns {number} */
export function elapsed(t0) { return Math.round((performance.now() - t0) * 10) / 10; }
/** @internal An error, as the one line a detail carries. @param {unknown} err @returns {string} */
export function reason(err) { return err instanceof Error ? err.message : String(err); }
