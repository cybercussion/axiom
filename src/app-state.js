/**
 * Application state — the keys THIS app owns, declared where the app lives.
 *
 * core/state.js knows no application's keys. Before this file existed, every
 * project that copied the core added its own keys to the core file, which is
 * why no two copies matched. An app declares its keys here instead, and the
 * modules that read them import this file — so the keys exist before first use
 * by construction (the module graph), not by the order of script tags.
 *
 * Storage keys are the historical ones: returning visitors keep their settings.
 */
import { state } from '@state';

const local = (() => { try { return globalThis.localStorage; } catch { return undefined; } })();

state.define('audioLevel', {
  initial: 80,
  storage: local,
  storageKey: 'axiom-audioLevel',
  parse: (raw) => { const n = parseInt(raw, 10); return Number.isFinite(n) ? n : 80; }
});
state.define('captionsEnabled', {
  initial: false,
  storage: local,
  storageKey: 'axiom-captionsEnabled',
  parse: (raw) => raw === 'true'
});
state.define('autoplayEnabled', {
  initial: true,
  storage: local,
  storageKey: 'axiom-autoplayEnabled',
  parse: (raw) => raw !== 'false'
});
state.define('sessionId', { initial: null, storage: local, storageKey: 'axiom-sessionId' });

// Session context belongs to the signed-in user. When there stops being one —
// logout, or a refresh token the provider rejected — whoever signs in next
// starts clean. Auth announces the user; the application decides what follows.
state.subscribe(({ key, value }) => {
  if (key === 'user' && value === null) state.set('sessionId', null);
});
