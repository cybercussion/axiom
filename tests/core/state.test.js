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
