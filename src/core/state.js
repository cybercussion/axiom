/**
 * Project Axiom: State Singleton
 * A Proxy-wrapped singleton that broadcasts changes via EventTarget.
 */
import { config } from './config.js';
import { log } from './logger.js';

const bus = new EventTarget();

// --- Optimistic ledger --------------------------------------------------------
// A key with writes in flight is displayed as
//     confirmed ⊕ pending[0] ⊕ pending[1] ⊕ …          (in issue order)
// `confirmed` is the last value the server acknowledged, or the value from
// before the first optimistic write. A success folds into `confirmed` only once
// every EARLIER write has settled; a failure excises its own patch and nothing
// else. So no failure can resurrect a value that a later, successful write
// replaced — which a plain "restore the backup" rollback does.
const ledgers = new Map();

const isSmart = (v) => !!v && typeof v === 'object' && 'data' in v;

/** One mutate() payload: an object merges into data; anything else replaces it. */
const applyPayload = (base, payload) => {
  const current = isSmart(base) ? base : { data: base, status: 'idle' };
  const data = (typeof payload === 'object' && payload !== null)
    ? { ...current.data, ...payload }
    : payload;
  return { ...current, data };
};

// --- Declared keys and their persistence -------------------------------------
// The framework's own keys live here. An application declares ITS keys in its
// own module with state.define(), so this file never needs to know that any
// application exists — and no two projects ever have a reason to edit it.
/**
 * @typedef {{ id: string, message: string, type: 'info'|'success'|'warning'|'error', duration: number }} Notification
 *
 * The framework's keys. An application adds its own with state.define(), which
 * is why the index signature is open.
 * @typedef {{
 *   route: string|null,
 *   query: Record<string, string>,
 *   params: Record<string, string>,
 *   navigation: import('./router.js').Navigation|null,
 *   navStyle: string,
 *   transition: { type: string, direction: string },
 *   transitioning?: boolean,
 *   notifications: Notification[],
 *   theme?: string,
 *   user?: Object|null,
 *   [key: string]: any
 * }} StateData
 */
/** @type {StateData} */
const store = {
  route: null,
  query: {},
  params: {},
  navigation: null,
  navStyle: config.NAV_STYLE,
  transition: { type: 'fade', direction: 'forward' },
  notifications: []
};

/** key -> { storage, storageKey, serialize } for keys declared with storage. */
const persisted = new Map();
const declared = new Set();

// Web Storage throws in some private modes, on quota, and in sandboxed frames
// (an LMS iframe, for one). A preference that cannot persist degrades to
// memory; it never takes the app down with it.
const storageGet = (storage, k) => { try { return storage.getItem(k); } catch { return null; } };
const storageSet = (storage, k, v) => { try { storage.setItem(k, v); } catch { /* memory only */ } };
const storageRemove = (storage, k) => { try { storage.removeItem(k); } catch { /* memory only */ } };
const localOrNothing = () => { try { return globalThis.localStorage; } catch { return undefined; } };

const announce = (key, value) => bus.dispatchEvent(new CustomEvent('update', { detail: { key, value } }));

export const state = {
  /** @type {StateData} */
  data: new Proxy(store, {
    set(target, key, value) {
      if (target[key] === value) return true;
      target[key] = value;

      const p = persisted.get(key);
      if (p) {
        if (value === null || value === undefined) storageRemove(p.storage, p.storageKey);
        else storageSet(p.storage, p.storageKey, p.serialize(value));
      }

      announce(key, value);
      return true;
    }
  }),

  // Surgical Getter: Because state.data.theme is too many keystrokes
  /** @param {string} key @returns {any} */
  get(key) {
    return this.data[key];
  },

  /**
   * Declare a key: its initial value and, optionally, where it persists. The one
   * place a key's storage is decided — core declares the framework's keys, and
   * an application declares its own from its own module.
   *
   *   state.define('volume', {
   *     initial: 80,
   *     storage: localStorage,              // or sessionStorage; omit = memory only
   *     storageKey: 'myapp-volume',         // default: the key itself
   *     parse: (raw) => parseInt(raw, 10),  // stored string -> value (default: as-is)
   *     serialize: String                   // value -> stored string (default)
   *   });
   *
   * A stored value wins over `initial`, and declaring a default never writes it.
   * Setting null/undefined removes the stored entry. Idempotent: defining a key
   * again returns its live value and changes nothing.
   * @template T
   * @param {string} key
   * @param {{ initial?: T, storage?: Pick<Storage, 'getItem'|'setItem'|'removeItem'>, storageKey?: string, parse?: (raw: string) => T, serialize?: (value: T) => string }} [options]
   * @returns {T} the key's current value
   */
  define(key, { initial, storage, storageKey = key, parse = (raw) => raw, serialize = String } = {}) {
    if (declared.has(key)) return store[key];
    declared.add(key);

    let value = initial;
    if (storage) {
      persisted.set(key, { storage, storageKey, serialize });
      const raw = storageGet(storage, storageKey);
      if (raw !== null) {
        try { value = parse(raw); } catch { value = initial; } // corrupt entry -> default
      }
    }
    store[key] = value; // direct: declaring must not write the default back
    announce(key, value);
    return value;
  },

  // Set Helper: For when you want to feel like you're using a real framework
  /** @param {string} key @param {any} value */
  set(key, value) {
    this.data[key] = value;
  },

  /**
   * Functional update — the supported way to change NESTED data.
   * state.data is shallowly reactive: `state.data.user.name = 'x'` mutates the
   * held object in place, the Proxy never sees a set, and nothing re-renders.
   * Return the next value instead of mutating the current one:
   *     state.update('user', u => ({ ...u, name: 'x' }))
   * @template T
   * @param {string} key
   * @param {(current: T) => T} fn
   * @returns {T} the value that was set
   */
  update(key, fn) {
    const current = this.get(key);
    const next = fn(current);
    if (next === current && next !== null && typeof next === 'object') {
      log.warn(`state.update('${key}'): the updater returned the same object. In-place mutation does not notify — return a new one ({ ...prev, field }).`);
      return next;
    }
    this.set(key, next);
    return next;
  },

  // Derived state helper
  /** @template T, R @param {string} key @param {(value: T) => R} selectorFn @returns {R} */
  select(key, selectorFn) {
    return selectorFn(this.get(key));
  },

  /**
   * Universal Query: Handles async sets with status tracking.
   * Automated "Loading", "Error", "Stale" states.
   * @template T
   * @param {string} key - The state key to populate
   * @param {() => Promise<T>} fetcher - Async function returning the data
   * @param {number} [ttl] - Time to live in ms (default 30s)
   * @returns {Promise<T>}
   */
  async query(key, fetcher, ttl = 30000) {
    const current = this.get(key) || {};
    const now = Date.now();

    // Stale Check: If we have data and it's fresh, return it
    if (current.status === 'success' && current.timestamp && (now - current.timestamp < ttl)) {
      return current.data;
    }

    // Set Loading (preserve existing data for UI continuity)
    this.set(key, { ...current, status: 'loading', error: null });

    try {
      const data = await fetcher();
      this.set(key, {
        data,
        status: 'success',
        error: null,
        timestamp: now
      });
      return data;
    } catch (err) {
      log.error(`Axiom Query Error [${key}]:`, err);
      this.set(key, {
        ...current,
        status: 'error',
        error: err
      });
      throw err;
    }
  },

  /**
   * Optimistic Mutation
   * Updates local state immediately, then runs the remote task. Safe to call
   * again on the same key while an earlier call is still in flight — see the
   * ledger at the top of this file. Resolves (never rejects) once THIS write has
   * settled; a failure is reported through notify() and the log.
   *
   * Contract: a failure removes exactly its own change. It never restores a
   * value some other, successful write has since replaced.
   * @param {string} key
   * @param {any} payload - an object merges into the current data; anything else replaces it
   * @param {() => Promise<unknown>} remoteTask
   * @returns {Promise<void>}
   */
  async mutate(key, payload, remoteTask) {
    let ledger = ledgers.get(key);
    if (ledger) this._rebase(key, ledger);
    else {
      ledger = { confirmed: this.get(key), pending: [], projected: undefined };
      ledgers.set(key, ledger);
    }

    const entry = { payload, done: false };
    ledger.pending.push(entry);
    this._project(key, ledger);                                   // 1. optimistic

    try {
      await remoteTask();
      this._rebase(key, ledger);
      entry.done = true;                                          // 2a. acknowledged
    } catch (err) {
      this._rebase(key, ledger);
      ledger.pending.splice(ledger.pending.indexOf(entry), 1);    // 2b. excised
      this.notify(`Mutation Failed: Rolling back.`, 'error');
      log.error(`Axiom Mutation Failed [${key}]: Rolling back.`, err);
    }

    // Fold every acknowledged write at the FRONT. A later success waits behind an
    // earlier write that is still in flight, so it is applied in issue order.
    while (ledger.pending[0]?.done) {
      const { payload: acked } = ledger.pending.shift();
      ledger.confirmed = { ...applyPayload(ledger.confirmed, acked), status: 'success' };
    }

    if (ledger.pending.length) {
      this._project(key, ledger);
      return;
    }

    ledgers.delete(key);
    // Nothing in flight: show exactly what is confirmed. A primitive or null
    // stays itself; only a smart object carries a status, and a 'syncing' one
    // (set directly, outside mutate) is settled rather than left in limbo.
    const settled = (isSmart(ledger.confirmed) && ledger.confirmed.status === 'syncing')
      ? { ...ledger.confirmed, status: 'success' }
      : ledger.confirmed;
    this.set(key, settled);
  },

  /** @internal Show confirmed ⊕ every pending patch, marked syncing. */
  _project(key, ledger) {
    let value = ledger.confirmed;
    for (const { payload } of ledger.pending) value = applyPayload(value, payload);
    value = { ...value, status: 'syncing' };
    ledger.projected = value;
    this.set(key, value);
  },

  /**
   * A write to this key from OUTSIDE the ledger — a query refetch, a socket push,
   * a direct set — is newer truth than anything the ledger holds. It becomes the
   * confirmed base, and the still-pending patches layer on top of it.
   * @internal
   */
  _rebase(key, ledger) {
    const current = this.get(key);
    if (current !== ledger.projected) ledger.confirmed = current;
  },

  // Features just call: state.subscribe(({ key, value }) => { ... })
  /**
   * @param {(change: { key: string, value: any }) => void} callback
   * @returns {() => void} unsubscribe
   */
  subscribe(callback) {
    const handler = (e) => callback(e.detail);
    bus.addEventListener('update', handler);
    return () => bus.removeEventListener('update', handler); // Cleanup
  },

  /**
   * Toast Notification Helper
   * Pushes a notification to state and auto-removes it.
   * @param {string} message - rendered as text, never markup
   * @param {'info'|'success'|'warning'|'error'} [type]
   * @param {number} [duration] - ms; 0 keeps it until dismissed
   */
  notify(message, type = 'info', duration = 3000) {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const notification = { id, message, type, duration };

    // Immutable push
    this.set('notifications', [...(this.get('notifications') || []), notification]);

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => {
        this.dismissToast(id);
      }, duration);
    }
  },

  /** @param {string} id */
  dismissToast(id) {
    const list = this.get('notifications') || [];
    this.set('notifications', list.filter(t => t.id !== id));
  }
};

// The design system reads `theme` in every component (BaseComponent), which
// makes it a framework key rather than an application preference.
state.define('theme', { initial: 'dark', storage: localOrNothing(), storageKey: 'axiom-theme' });
