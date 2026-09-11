import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from './serve.js';
import { currentPolicy, policyFor, readConfig } from './csp.js';
import fs from 'node:fs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const servers = {};
const base = {};

before(async () => {
  for (const [name, csp] of [['plain', false], ['csp', true]]) {
    servers[name] = createServer({ root: ROOT, csp });
    await new Promise((r) => servers[name].listen(0, '127.0.0.1', r));
    base[name] = `http://127.0.0.1:${servers[name].address().port}`;
  }
});
after(() => Promise.all(Object.values(servers).map((s) => new Promise((r) => s.close(r)))));

test('serves index.html at / with no-store', async () => {
  const res = await fetch(`${base.plain}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.match(await res.text(), /<script type="importmap">/);
});

test('an extensionless deep link falls back to index.html', async () => {
  const res = await fetch(`${base.plain}/dashboard`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /id="app-container"/);
});

test('modules are served as JavaScript; a missing file is a 404, not the index', async () => {
  const js = await fetch(`${base.plain}/src/core/state.js`);
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /text\/javascript/);
  assert.equal((await fetch(`${base.plain}/src/core/nope.js`)).status, 404);
});

test('encoded traversal cannot leave the root', async () => {
  const res = await fetch(`${base.plain}/%2e%2e/%2e%2e/%2e%2e/etc/passwd`);
  assert.ok(!/root:/.test(await res.text()));
});

test('--csp serves the exact policy tools/csp.js would write, on the index and on deep links', async () => {
  const source = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const expected = policyFor(source, readConfig(fileURLToPath(new URL('../axiom-config.js', import.meta.url))));
  for (const p of ['/', '/components']) {
    assert.equal(currentPolicy(await (await fetch(`${base.csp}${p}`)).text()), expected, p);
  }
  assert.equal(currentPolicy(await (await fetch(`${base.plain}/`)).text()), null, 'the plain server adds no policy');
});
