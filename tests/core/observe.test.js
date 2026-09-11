/**
 * Runtime events: every start ends exactly once, with the same id, and no
 * detail carries a header, a body, a payload or a token.
 */
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { observe, emit, EVENTS } from '@core/observe.js';
import { gateway } from '@core/gateway.js';
import { state } from '@state';
import { auth } from '@core/auth.js';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

/** Every runtime event dispatched while fn runs. */
const recording = async (fn) => {
  const seen = [];
  const stop = observe((name, detail) => seen.push({ name, ...detail }));
  try { await fn(); } finally { stop(); }
  return seen;
};
/** Each id's phases, in order. */
const byId = (events) => events.reduce((m, e) => m.set(e.id, [...(m.get(e.id) ?? []), e.phase]), new Map());
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const REQUEST_FIELDS = ['name', 'phase', 'id', 'method', 'url', 'status', 'ms', 'error'];

describe('axiom:request', () => {
  test('a request that succeeds: start, then response — one id, the status, a duration', async () => {
    globalThis.fetch = async () => new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } });
    const seen = await recording(() => gateway.post('/thing', { secret: 'payload' }, { 'X-Custom': 'header' }));
    assert.deepEqual(seen.map((e) => e.phase), ['start', 'response']);
    assert.equal(seen[0].id, seen[1].id);
    assert.equal(seen[1].status, 200);
    assert.ok(seen[1].ms >= 0);
    for (const e of seen) assert.deepEqual(Object.keys(e).filter((k) => !REQUEST_FIELDS.includes(k)), [], 'no headers, body or token');
    assert.doesNotMatch(JSON.stringify(seen), /payload|header|Bearer/);
  });

  test('a failure ends in error with its status; a cancelled request ends in abort', async () => {
    globalThis.fetch = async () => new Response('nope', { status: 503, headers: { 'content-type': 'text/plain' } });
    const failed = await recording(() => gateway.get('/thing').catch(() => {}));
    assert.deepEqual(failed.map((e) => [e.phase, e.status]), [['start', undefined], ['error', 503]]);

    globalThis.fetch = (url, { signal }) => new Promise((_, reject) => {
      const fail = () => reject(signal.reason);
      if (signal.aborted) fail(); else signal.addEventListener('abort', fail);
    });
    const controller = new AbortController();
    const aborted = await recording(async () => {
      const pending = gateway.get('/slow', {}, { signal: controller.signal }).catch(() => {});
      controller.abort();
      await pending;
    });
    assert.deepEqual(aborted.map((e) => e.phase), ['start', 'abort']);
    assert.equal(aborted[1].error, undefined, 'a cancellation is not an error');
  });

  test('graphql requests are narrated the same way', async () => {
    globalThis.fetch = async () => new Response('{"data":{"x":1}}', { headers: { 'content-type': 'application/json' } });
    const seen = await recording(() => gateway.graphql('{ x }'));
    assert.deepEqual(seen.map((e) => [e.phase, e.method]), [['start', 'POST'], ['response', 'POST']]);
  });
});

describe('axiom:mutation', () => {
  test('every mutation that starts ends exactly once — success or rollback', async () => {
    const key = `observe_${Math.random().toString(36).slice(2)}`;
    state.set(key, { data: { n: 0 }, status: 'idle' });
    const [a, b, c] = [deferred(), deferred(), deferred()];
    const seen = await recording(async () => {
      const writes = [
        state.mutate(key, { n: 1 }, () => a.promise),
        state.mutate(key, { n: 2 }, () => b.promise),
        state.mutate(key, { n: 3 }, () => c.promise),
      ];
      c.resolve(); b.reject(new Error('rejected by the server')); a.resolve();
      await Promise.all(writes);
    });
    const mutations = seen.filter((e) => e.name === 'axiom:mutation');
    const phases = [...byId(mutations).values()];
    assert.equal(phases.length, 3);
    for (const p of phases) assert.equal(p.length, 2, `each start ends once: ${p}`);
    assert.deepEqual(phases.map((p) => p[1]).sort(), ['rollback', 'success', 'success']);
    assert.equal(mutations.find((e) => e.phase === 'rollback').error, 'rejected by the server');
    assert.doesNotMatch(JSON.stringify(mutations), /"n":/, 'no payload rides along');
  });
});

describe('axiom:auth', () => {
  test('logout is announced, with nothing but its phase', async () => {
    const seen = await recording(() => auth.logout());
    assert.deepEqual(seen.filter((e) => e.name === 'axiom:auth'), [{ name: 'axiom:auth', phase: 'logout' }]);
  });
});

describe('observe()', () => {
  test('one function for every name; stopping stops it; a throwing handler is contained', () => {
    assert.ok(EVENTS.includes('axiom:router-error') && EVENTS.includes('axiom:component-error'));
    const seen = [];
    const stop = observe((name, detail) => seen.push([name, detail.phase]));
    for (const name of EVENTS) emit(name, { phase: 'probe' });
    stop();
    emit('axiom:auth', { phase: 'after-stop' });
    assert.deepEqual(seen, EVENTS.map((name) => [name, 'probe']));

    const stopBad = observe(() => { throw new Error('a broken telemetry handler'); });
    assert.doesNotThrow(() => emit('axiom:auth', { phase: 'probe' }));
    stopBad();
  });
});
