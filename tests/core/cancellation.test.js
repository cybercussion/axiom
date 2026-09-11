/**
 * Cancellation is part of the contract. An aborted query writes no result — a
 * navigation that lost cannot leave its data on the page that won — and an
 * aborted request rejects as an AbortError: never a GatewayError, never data.
 */
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { state } from '@state';
import { gateway, GatewayError } from '@core/gateway.js';

const later = (value, ms) => new Promise((r) => setTimeout(() => r(value), ms));
// Like fetch: rejects at once for an already-aborted signal, or when it aborts.
const abortable = (signal) => new Promise((_, reject) => {
  const fail = () => reject(new DOMException('Aborted', 'AbortError'));
  if (signal.aborted) fail(); else signal.addEventListener('abort', fail);
});
let n = 0;
const k = (label) => `cancel_${label}_${n++}`;

describe('state.query(key, fetcher, ttl, { signal })', () => {
  test('aborted mid-flight: no result is written and the prior value comes back', async () => {
    const key = k('late');
    state.set(key, { data: 'before', status: 'success', timestamp: 1 });
    const ctl = new AbortController();
    const pending = state.query(key, () => later('late', 30), 0, { signal: ctl.signal });
    ctl.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    await later(null, 50);
    assert.deepEqual(state.get(key), { data: 'before', status: 'success', timestamp: 1 });
  });

  test("a fetcher's AbortError is cancellation, not an error state", async () => {
    const key = k('abortError');
    state.set(key, { data: 'before', status: 'success', timestamp: 1 });
    const ctl = new AbortController();
    const pending = state.query(key, () => abortable(ctl.signal), 0, { signal: ctl.signal });
    ctl.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(state.get(key).status, 'success');
    assert.equal(state.get(key).data, 'before');
  });

  test('an already-aborted signal never starts the fetch', async () => {
    const key = k('pre');
    let called = false;
    const ctl = new AbortController();
    ctl.abort();
    await assert.rejects(state.query(key, async () => { called = true; return 1; }, 0, { signal: ctl.signal }), { name: 'AbortError' });
    assert.equal(called, false);
    assert.equal(state.get(key), undefined);
  });

  test('the router case: an aborted query cannot overwrite a newer one', async () => {
    const key = k('newer');
    const a = new AbortController();
    const slow = state.query(key, () => later({ id: 1 }, 40), 0, { signal: a.signal });
    a.abort();
    await state.query(key, () => later({ id: 2 }, 5), 0);
    await assert.rejects(slow, { name: 'AbortError' });
    await later(null, 60);
    assert.deepEqual(state.get(key).data, { id: 2 });
  });

  test('without a signal, behaviour is unchanged', async () => {
    const key = k('plain');
    assert.equal(await state.query(key, async () => 7), 7);
    assert.equal(state.get(key).status, 'success');
  });
});

describe('gateway { signal }', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  test('the signal reaches fetch; an abort rejects as AbortError, not GatewayError', async () => {
    let seen;
    globalThis.fetch = (url, opts) => { seen = opts.signal; return abortable(opts.signal); };
    const ctl = new AbortController();
    const pending = gateway.get('/slow', {}, { expect: 'json', signal: ctl.signal });
    ctl.abort();
    await assert.rejects(pending, (err) => {
      assert.equal(err.name, 'AbortError');
      assert.ok(!(err instanceof GatewayError));
      return true;
    });
    assert.equal(seen, ctl.signal);
  });

  test('graphql takes a signal too', async () => {
    let seen;
    globalThis.fetch = (url, opts) => { seen = opts.signal; return abortable(opts.signal); };
    const ctl = new AbortController();
    const pending = gateway.graphql('{ me { id } }', {}, {}, { signal: ctl.signal });
    ctl.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(seen, ctl.signal);
  });
});
