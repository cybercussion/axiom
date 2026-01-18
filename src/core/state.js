/**
 * Project Axiom: State Singleton
 * A Proxy-wrapped singleton that broadcasts changes via EventTarget.
 */
const bus = new EventTarget();

export const state = {
  data: new Proxy({
    route: null, // Start at null so 'home' triggers the Proxy
    navStyle: 'dock',
    transition: { type: 'fade', direction: 'forward' },
    theme: localStorage.getItem('axiom-theme') || 'dark',
    items: [],
    notifications: []
  }, {
    set(target, key, value) {
      if (target[key] === value) return true;
      target[key] = value;

      // Persistence bridge
      if (key === 'theme') localStorage.setItem('axiom-theme', value);

      if (location.hostname === 'localhost') {
        console.log(`%c Axiom Delta: ${key}`, 'color: #3b82f6; font-weight: bold;', value);
      }

      bus.dispatchEvent(new CustomEvent('update', {
        detail: { key, value }
      }));
      return true;
    }
  }),

  // Surgical Getter: Because state.data.theme is too many keystrokes
  get(key) {
    return this.data[key];
  },

  // Set Helper: For when you want to feel like you're using a real framework
  set(key, value) {
    this.data[key] = value;
  },

  // Derived state helper
  select(key, selectorFn) {
    return selectorFn(this.get(key));
  },

  /**
   * Universal Query: Handles async sets with status tracking.
   * Automated "Loading", "Error", "Stale" states.
   * @param {string} key - The state key to populate
   * @param {function} fetcher - Async function returning the data
   * @param {number} ttl - Time to live in ms (default 30s)
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
      console.error(`Axiom Query Error [${key}]:`, err);
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
   * Updates local state immediately, then runs the remote task.
   */
  async mutate(key, payload, remoteTask) {
    const raw = this.get(key);
    // Normalize to smart structure if needed
    const current = (raw && typeof raw === 'object' && 'data' in raw)
      ? raw
      : { data: raw, status: 'idle' };

    const backup = raw; // Keep exact backup (primitive or object)

    // Calculate new data: If payload is object merge, else replace
    const newData = (typeof payload === 'object' && payload !== null)
      ? { ...current.data, ...payload }
      : payload;

    // 1. Optimistic Update (Always promotes to Smart Object)
    this.set(key, { ...current, data: newData, status: 'syncing' });

    try {
      await remoteTask();
      // Keep distinct 'success' status
      const succ = this.get(key);
      this.set(key, { ...succ, status: 'success' });
    } catch (err) {
      // 2. Rollback to EXACT backup, but ensure we don't restore a 'syncing' status
      // If we stacked mutations, the backup might be 'syncing'. We force 'success' to avoid UI stuck in limbo.
      const safeBackup = { ...backup, status: (backup.status === 'syncing' ? 'success' : backup.status) };
      this.set(key, safeBackup);
      this.notify(`Mutation Failed: Rolling back.`, 'error');
      console.error(`Axiom Mutation Failed [${key}]: Rolling back.`, err);
    }
  },

  // Features just call: state.subscribe(({ key, value }) => { ... })
  subscribe(callback) {
    const handler = (e) => callback(e.detail);
    bus.addEventListener('update', handler);
    return () => bus.removeEventListener('update', handler); // Cleanup
  },

  /**
   * Toast Notification Helper
   * Pushes a notification to state and auto-removes it.
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

  dismissToast(id) {
    const list = this.get('notifications') || [];
    this.set('notifications', list.filter(t => t.id !== id));
  }
};
