#!/usr/bin/env node
/**
 * tools/bench.js — how fast the state layer is. Reported, never gated.
 *
 *   npm run bench              a table
 *   npm run bench -- --json    one JSON object per line, each carrying its regime
 *
 * Runs under the test harness (node --import ./tests/helpers/setup.js), so it
 * imports `@state` exactly as the app does.
 *
 * Timings move with the machine, its load and the JIT: a threshold here would fail
 * on a busy CI runner and pass on a quiet laptop, so this prints and exits 0. The
 * budgets CI enforces are the deterministic ones — shipped bytes (tools/weigh.js)
 * and layout shift (the browser suite).
 */
import os from 'node:os';
import events from 'node:events';

// Node warns past 10 listeners on one EventTarget; a page with a hundred subscribed
// components is ordinary. Raised before the store's bus is created.
events.defaultMaxListeners = 1000;
const { state } = await import('@state');

const N = 10_000;

/** Warm the path once, then time it. `fn(n)` does n operations and may be async. */
const run = async (name, ops, fn) => {
  await fn(Math.min(ops, 200));
  const t0 = performance.now();
  await fn(ops);
  const ms = performance.now() - t0;
  return { name, ops, ms: +ms.toFixed(2), usPerOp: +((ms * 1000) / ops).toFixed(3) };
};

const results = [
  await run('set, one subscriber', N, (n) => {
    let heard = 0;
    const off = state.subscribe(({ key }) => { if (key === 'bench:set') heard += 1; });
    for (let i = 0; i < n; i++) state.set('bench:set', i);
    off();
    if (heard !== n) throw new Error(`the subscriber heard ${heard} of ${n} changes`);
  }),
  await run('set, 100 subscribers', 1_000, (n) => {
    const offs = Array.from({ length: 100 }, () => state.subscribe(() => {}));
    for (let i = 0; i < n; i++) state.set('bench:fanout', i);
    offs.forEach((off) => off());
  }),
  await run('update, object replace', N, (n) => {
    state.set('bench:obj', { n: 0 });
    for (let i = 0; i < n; i++) state.update('bench:obj', (o) => ({ ...o, n: o.n + 1 }));
    if (state.get('bench:obj').n !== n) throw new Error('update lost a write');
  }),
  await run('mutate, all in flight on one key, then acked', 1_000, async (n) => {
    state.set('bench:mutate', { n: -1 });
    await Promise.all(Array.from({ length: n }, (_, i) => state.mutate('bench:mutate', { n: i }, async () => {})));
    // mutate keeps a smart object: { data, status }
    if (state.get('bench:mutate').data?.n !== n - 1) throw new Error('the last acknowledged write did not win');
  }),
  await run('query, cache hit', N, async (n) => {
    await state.query('bench:query', async () => 42, 60_000);
    for (let i = 0; i < n; i++) await state.query('bench:query', async () => 42, 60_000);
  }),
];

const regime = { node: process.version, platform: `${process.platform}-${process.arch}`, cpu: os.cpus()[0]?.model ?? 'unknown', at: new Date().toISOString() };
if (process.argv.includes('--json')) {
  for (const r of results) console.log(JSON.stringify({ ...r, regime }));
} else {
  console.log(`state — ${regime.node} · ${regime.platform} · ${regime.cpu}`);
  for (const r of results) console.log(`  ${r.name.padEnd(46)} ${String(r.ops).padStart(6)} ops ${r.ms.toFixed(1).padStart(8)} ms ${r.usPerOp.toFixed(2).padStart(8)} µs/op`);
}
