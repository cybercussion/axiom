/**
 * Core state primitive — regression tests.
 *
 * Imports `@state`, the same specifier index.html's importmap declares, so what
 * is under test is exactly what ships. See tests/helpers/setup.js.
 *
 * Note: a failed mutate() calls notify(), which schedules a 3s auto-dismiss
 * timer that cannot be unref'd portably (browsers have no unref). The suite
 * therefore takes ~3s of wall clock after the last assertion. That is the
 * timer draining, not a hang.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { state } from '@state';

const failing = () => Promise.reject(new Error('remote exploded'));
const ok = async () => 'committed';

let counter = 0;
const freshKey = (label) => `test_${label}_${counter++}`;

describe('mutate() rollback', () => {
  // mutate() deliberately keeps the UN-normalized value as its backup, so the
  // rollback must not assume it is an object. Spreading a primitive gave {} for
  // a number and a char map for a string; `backup.status` THREW on null.
  const shapes = [
    ['a number', 5],
    ['a string', 'hello'],
    ['null', null],
    ['a plain object', { name: 'Ann' }],
    ['a smart object', { data: { n: 1 }, status: 'idle' }],
  ];

  for (const [label, initial] of shapes) {
    test(`restores ${label} exactly when the remote task fails`, async () => {
      const key = freshKey('rollback');
      state.set(key, initial);
      await state.mutate(key, { x: 1 }, failing);
      assert.deepEqual(state.get(key), initial);
    });
  }

  test('a rollback error never replaces the caller failure', async () => {
    // The null backup threw a TypeError INSIDE the catch block. It escaped
    // mutate(), replaced the real error and skipped the notify below it.
    const key = freshKey('escape');
    state.set(key, null);
    await assert.doesNotReject(() => state.mutate(key, { x: 1 }, failing));
    assert.equal(state.get(key), null);
  });

  test('a failed mutation never leaves status pinned at syncing', async () => {
    for (const initial of [5, 'hello', null, { data: {}, status: 'idle' }]) {
      const key = freshKey('limbo');
      state.set(key, initial);
      await state.mutate(key, { x: 1 }, failing);
      assert.notEqual(state.get(key)?.status, 'syncing');
    }
  });

  test('a stacked syncing backup rolls back to success, not limbo', async () => {
    const key = freshKey('stacked');
    state.set(key, { data: { n: 1 }, status: 'syncing' });
    await state.mutate(key, { x: 1 }, failing);
    assert.deepEqual(state.get(key), { data: { n: 1 }, status: 'success' });
  });
});

describe('mutate() commit', () => {
  test('an object payload merges into current data and commits success', async () => {
    const key = freshKey('merge');
    state.set(key, { data: { a: 1 }, status: 'idle' });
    await state.mutate(key, { b: 2 }, ok);
    assert.deepEqual(state.get(key).data, { a: 1, b: 2 });
    assert.equal(state.get(key).status, 'success');
  });

  test('a primitive payload replaces data', async () => {
    const key = freshKey('replace');
    state.set(key, 1);
    await state.mutate(key, 42, ok);
    assert.equal(state.get(key).data, 42);
  });

  test('promotes a primitive to a smart object during the optimistic phase', async () => {
    const key = freshKey('promote');
    state.set(key, 7);
    const seen = [];
    const off = state.subscribe(({ key: k, value }) => { if (k === key) seen.push(value); });
    await state.mutate(key, 9, ok);
    off();
    assert.equal(seen[0].status, 'syncing');
    assert.equal(seen[0].data, 9);
  });
});

describe('query()', () => {
  test('populates data, marks success and stamps a timestamp', async () => {
    const key = freshKey('query');
    const data = await state.query(key, async () => ({ v: 1 }));
    assert.deepEqual(data, { v: 1 });
    const entry = state.get(key);
    assert.equal(entry.status, 'success');
    assert.ok(entry.timestamp);
  });

  test('serves from cache inside the ttl without refetching', async () => {
    const key = freshKey('cache');
    let calls = 0;
    const fetcher = async () => ++calls;
    await state.query(key, fetcher, 30000);
    await state.query(key, fetcher, 30000);
    assert.equal(calls, 1);
  });

  test('refetches once the ttl has elapsed', async () => {
    const key = freshKey('ttl');
    let calls = 0;
    const fetcher = async () => ++calls;
    await state.query(key, fetcher, 0);
    await state.query(key, fetcher, 0);
    assert.equal(calls, 2);
  });

  test('rethrows on failure, marking error while preserving previous data', async () => {
    const key = freshKey('queryerr');
    await state.query(key, async () => 'good');
    await assert.rejects(() => state.query(key, failing, 0));
    const entry = state.get(key);
    assert.equal(entry.status, 'error');
    assert.equal(entry.data, 'good');
  });
});

describe('subscriptions', () => {
  test('broadcast key and value, and unsubscribe cleanly', () => {
    const key = freshKey('sub');
    const seen = [];
    const off = state.subscribe(({ key: k, value }) => { if (k === key) seen.push(value); });
    state.set(key, 1);
    state.set(key, 2);
    off();
    state.set(key, 3);
    assert.deepEqual(seen, [1, 2]);
  });
});

describe('mutate() under concurrency — no failure resurrects a replaced value', () => {
  // The external review's scenario: A; m1 -> B, m2 -> C; m1 fails, m2 succeeds.
  // A rollback that restores "the value before m1" discards m2, which the server
  // accepted. Each case below controls settlement order explicitly.
  const deferred = () => {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };

  test('replace: m1 fails then m2 succeeds — lands on m2', async () => {
    const key = freshKey('race_replace');
    state.set(key, 'A');
    const d1 = deferred(), d2 = deferred();
    const p1 = state.mutate(key, 'B', () => d1.promise);
    const p2 = state.mutate(key, 'C', () => d2.promise);
    d1.reject(new Error('m1 rejected')); await p1;
    d2.resolve(); await p2;
    assert.equal(state.get(key)?.data, 'C');
    assert.equal(state.get(key)?.status, 'success');
  });

  test('replace: m2 succeeds then m1 fails — still lands on m2', async () => {
    const key = freshKey('race_replace_rev');
    state.set(key, 'A');
    const d1 = deferred(), d2 = deferred();
    const p1 = state.mutate(key, 'B', () => d1.promise);
    const p2 = state.mutate(key, 'C', () => d2.promise);
    d2.resolve(); await p2;
    d1.reject(new Error('m1 rejected')); await p1;
    assert.equal(state.get(key)?.data, 'C');
  });

  test('merge: m1 fails, m2 succeeds — m2 field kept, m1 field excised', async () => {
    const key = freshKey('race_merge');
    state.set(key, { data: { a: 1 }, status: 'idle' });
    const d1 = deferred(), d2 = deferred();
    const p1 = state.mutate(key, { b: 2 }, () => d1.promise);
    const p2 = state.mutate(key, { c: 3 }, () => d2.promise);
    d1.reject(new Error('m1 rejected')); await p1;
    d2.resolve(); await p2;
    assert.deepEqual(state.get(key).data, { a: 1, c: 3 });
  });

  test('merge: both succeed out of order — both fields committed', async () => {
    const key = freshKey('race_both');
    state.set(key, { data: { a: 1 }, status: 'idle' });
    const d1 = deferred(), d2 = deferred();
    const p1 = state.mutate(key, { b: 2 }, () => d1.promise);
    const p2 = state.mutate(key, { c: 3 }, () => d2.promise);
    d2.resolve(); await p2;
    d1.resolve(); await p1;
    assert.deepEqual(state.get(key).data, { a: 1, b: 2, c: 3 });
    assert.equal(state.get(key).status, 'success');
  });

  test('status reads syncing while ANY write on the key is still pending', async () => {
    const key = freshKey('race_status');
    state.set(key, { data: {}, status: 'idle' });
    const d1 = deferred(), d2 = deferred();
    const p1 = state.mutate(key, { b: 2 }, () => d1.promise);
    const p2 = state.mutate(key, { c: 3 }, () => d2.promise);
    d1.resolve(); await p1;
    assert.equal(state.get(key).status, 'syncing', 'm2 is still in flight');
    d2.resolve(); await p2;
    assert.equal(state.get(key).status, 'success');
  });

  test('an external write during a pending mutation becomes the new base', async () => {
    // e.g. a query refetch lands while the optimistic write is in flight: a
    // rollback must return to that fresher value, not to the pre-mutation one.
    const key = freshKey('race_external');
    state.set(key, { data: { a: 1 }, status: 'idle' });
    const d1 = deferred();
    const p1 = state.mutate(key, { b: 2 }, () => d1.promise);
    state.set(key, { data: { a: 9, z: 1 }, status: 'success' });
    d1.reject(new Error('m1 rejected')); await p1;
    assert.deepEqual(state.get(key).data, { a: 9, z: 1 });
  });
});

describe('update() — the supported way to change nested data', () => {
  // state.data is SHALLOWLY reactive: the Proxy sees assignments to its own
  // keys, never mutations inside the objects they hold. update() makes the
  // immutable change the easy one to write.

  test('characterization: mutating inside a held object does NOT notify', () => {
    const key = freshKey('shallow');
    state.set(key, { name: 'A' });
    const seen = [];
    const off = state.subscribe(({ key: k, value }) => { if (k === key) seen.push(value); });
    state.data[key].name = 'B';
    off();
    assert.deepEqual(seen, [], 'this is the documented rule, pinned so it cannot drift silently');
  });

  test('passes the current value and notifies with the returned one', () => {
    const key = freshKey('update');
    state.set(key, { name: 'A', prefs: { x: 1 } });
    const seen = [];
    const off = state.subscribe(({ key: k, value }) => { if (k === key) seen.push(value); });
    const result = state.update(key, (u) => ({ ...u, name: 'B' }));
    off();
    assert.deepEqual(result, { name: 'B', prefs: { x: 1 } });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].name, 'B');
    assert.deepEqual(state.get(key), result);
  });

  test('works for primitives and missing keys', () => {
    const key = freshKey('counter');
    state.update(key, (n = 0) => n + 1);
    state.update(key, (n = 0) => n + 1);
    assert.equal(state.get(key), 2);
  });

  test('returning the SAME object (mutated in place) warns instead of pretending it worked', async () => {
    const { log } = await import('@core/logger.js');
    const key = freshKey('inplace');
    state.set(key, { name: 'A' });
    const warnings = [];
    const original = log.warn;
    log.warn = (...args) => warnings.push(args.join(' '));
    try {
      state.update(key, (u) => { u.name = 'B'; return u; });
    } finally {
      log.warn = original;
    }
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /same object/i);
  });
});

describe('mutate(): the sequences the 2026-09-11 review named', () => {
  // Same guarantee the fuzz sweep checks over 2,000 random sequences, written out
  // in the review's own terms: a failure removes exactly its own change, and the
  // successes land in ISSUE order however they settle.
  const deferred = () => {
    let resolve, reject;
    const promise = new Promise((a, b) => { resolve = a; reject = b; });
    return { promise, resolve, reject };
  };

  test('A succeeds, B fails, C succeeds — B is excised, A and C land in issue order', async () => {
    const key = freshKey('review_abc');
    state.set(key, { data: { n: 0 }, status: 'idle' });
    const [a, b, c] = [deferred(), deferred(), deferred()];
    const writes = [
      state.mutate(key, { a: 1 }, () => a.promise),
      state.mutate(key, { b: 2 }, () => b.promise),
      state.mutate(key, { c: 3 }, () => c.promise),
    ];
    assert.equal(state.get(key).status, 'syncing', 'three in flight');
    c.resolve(); b.reject(new Error('refused')); a.resolve();   // settle out of issue order
    await Promise.all(writes);
    assert.deepEqual(state.get(key).data, { n: 0, a: 1, c: 3 }, "B's field must be gone, A's and C's kept");
    assert.equal(state.get(key).status, 'success');
  });

  test('A fails, B succeeds, C fails, D succeeds — only B and D land', async () => {
    const key = freshKey('review_abcd');
    state.set(key, { data: { n: 0 }, status: 'idle' });
    const [a, b, c, d] = [deferred(), deferred(), deferred(), deferred()];
    const writes = [
      state.mutate(key, { a: 1 }, () => a.promise),
      state.mutate(key, { b: 2 }, () => b.promise),
      state.mutate(key, { c: 3 }, () => c.promise),
      state.mutate(key, { d: 4 }, () => d.promise),
    ];
    d.resolve(); a.reject(new Error('refused')); c.reject(new Error('refused')); b.resolve();
    await Promise.all(writes);
    assert.deepEqual(state.get(key).data, { n: 0, b: 2, d: 4 });
    assert.equal(state.get(key).status, 'success');
  });
});
