/**
 * Invariant, fuzzed: for ANY sequence of optimistic mutations on one key — any mix
 * of outcomes, any settlement order — the final value is the initial value with
 * every SUCCESSFUL payload applied in ISSUE order. A failure never erases a
 * success. And while any write is pending, status reads 'syncing'.
 *
 * Seeded: a failing case prints its seed and sequence so it can be replayed.
 * AXIOM_FUZZ_CASES raises the count (default 2000).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { state } from '@state';
import { log } from '@core/logger.js';

const mulberry32 = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const CASES = Number(process.env.AXIOM_FUZZ_CASES || 2000);

// One payload's documented meaning: an object merges into data, anything else replaces it.
const isSmart = (v) => !!v && typeof v === 'object' && 'data' in v;
const applyOne = (base, payload) => {
  const cur = isSmart(base) ? base : { data: base, status: 'idle' };
  return { ...cur, data: (payload && typeof payload === 'object') ? { ...cur.data, ...payload } : payload };
};
// The oracle — deliberately a plain reduce over successes, not a ledger.
const oracle = (initial, ops) => {
  const wins = ops.filter((o) => o.ok);
  return wins.length ? { ...wins.reduce((v, o) => applyOne(v, o.payload), initial), status: 'success' } : initial;
};
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test(`mutate(): ${CASES} random sequences keep "initial + successes, in issue order"`, async () => {
  const quiet = { notify: state.notify, error: log.error };
  state.notify = () => {};       // a failure toast per case is noise here
  log.error = () => {};
  try {
    for (let c = 0; c < CASES; c++) {
      const seed = 1000 + c;
      const rand = mulberry32(seed);
      const pick = (arr) => arr[Math.floor(rand() * arr.length)];
      const key = `fuzz_${c}`;
      const initial = pick([{ data: { a: 0 }, status: 'idle' }, 0, 'x', null, { plain: true }]);
      state.set(key, initial);

      const n = 1 + Math.floor(rand() * 8);
      const ops = Array.from({ length: n }, (_, i) => ({
        i,
        ok: rand() < 0.5,
        payload: rand() < 0.2 ? Math.floor(rand() * 100) : { [pick(['a', 'b', 'c'])]: Math.floor(rand() * 100) },
        gate: deferred(),
      }));
      for (const op of ops) op.done = state.mutate(key, op.payload, () => op.gate.promise);

      const order = [...ops].sort(() => rand() - 0.5);   // random settlement order
      const settled = new Set();
      for (const op of order) {
        if (op.ok) op.gate.resolve(); else op.gate.reject(new Error('refused'));
        await op.done;
        settled.add(op.i);
        const pending = n - settled.size;
        const v = state.get(key);
        if (pending > 0) {
          assert.equal(v?.status, 'syncing', `seed ${seed}: ${pending} pending but status ${v?.status}`);
        }
      }
      assert.deepEqual(state.get(key), oracle(initial, ops),
        `seed ${seed}: ${JSON.stringify(ops.map((o) => ({ i: o.i, ok: o.ok, payload: o.payload })))} settled ${order.map((o) => o.i)}`);
    }
  } finally {
    state.notify = quiet.notify;
    log.error = quiet.error;
  }
});
