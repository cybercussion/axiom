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

/**
 * One case, from a seed. Shared by the sweep and by the coverage check below, so
 * the shapes that check reports are the shapes the sweep actually runs.
 */
const makeCase = (seed) => {
  const rand = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const initial = pick([{ data: { a: 0 }, status: 'idle' }, 0, 'x', null, { plain: true }]);
  const n = 1 + Math.floor(rand() * 8);
  const ops = Array.from({ length: n }, (_, i) => ({
    i,
    ok: rand() < 0.5,
    payload: rand() < 0.2 ? Math.floor(rand() * 100) : { [pick(['a', 'b', 'c'])]: Math.floor(rand() * 100) },
    gate: deferred(),
  }));
  const order = [...ops].sort(() => rand() - 0.5);   // random settlement order
  return { initial, ops, order };
};

test(`mutate(): ${CASES} random sequences keep "initial + successes, in issue order"`, async () => {
  const quiet = { notify: state.notify, error: log.error };
  state.notify = () => {};       // a failure toast per case is noise here
  log.error = () => {};
  try {
    for (let c = 0; c < CASES; c++) {
      const seed = 1000 + c;
      const key = `fuzz_${c}`;
      const { initial, ops, order } = makeCase(seed);
      const n = ops.length;
      state.set(key, initial);
      for (const op of ops) op.done = state.mutate(key, op.payload, () => op.gate.promise);
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

/**
 * The sweep covers these by construction; this names them, so "we fuzz it" is a
 * claim a reader can check rather than take on trust. Shapes from the 2026-09-11
 * review: a failure between two successes, and alternating failure/success.
 */
test('the corpus contains the sequences the review asked for', () => {
  const shapes = { 'ok,fail,ok': [true, false, true], 'fail,ok,fail,ok': [false, true, false, true] };
  const found = Object.fromEntries(Object.keys(shapes).map((k) => [k, 0]));
  for (let c = 0; c < CASES; c++) {
    const outcomes = makeCase(1000 + c).ops.map((o) => o.ok);
    for (const [name, want] of Object.entries(shapes)) {
      if (outcomes.length === want.length && want.every((v, i) => outcomes[i] === v)) found[name] += 1;
    }
  }
  for (const [name, n] of Object.entries(found)) {
    assert.ok(n > 0, `no case in the default ${CASES} has shape ${name} — the sweep no longer covers it`);
  }
  console.log(`      corpus: ${Object.entries(found).map(([k, v]) => `${k} ×${v}`).join(', ')}`);
});
