/**
 * README claims are tested, not trusted.
 *
 * The router was "roughly 200 lines" in the README long after it passed 500, and
 * an external review graded the README 6/10 for accuracy on exactly that. Every
 * number the README states that can rot sits inside a
 *     <!-- claim:NAME -->…<!-- /claim -->
 * marker (invisible when rendered), and this file checks it against the tree.
 * When a check fails, update the README — that is the point.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const claims = Object.fromEntries(
  [...read('README.md').matchAll(/<!-- claim:([\w-]+) -->([\s\S]*?)<!-- \/claim -->/g)].map(([, name, text]) => [name, text])
);
const numberIn = (text) => Number(String(text).replace(/[^\d.]/g, ''));
const wcLines = (p) => (read(p).match(/\n/g) || []).length; // `wc -l` semantics
const within = (claimed, actual, tolerance) => Math.abs(claimed - actual) / actual <= tolerance;

test('every checked claim is still marked in the README', () => {
  for (const name of ['runtime-deps', 'core-lines', 'router-lines', 'controls']) {
    assert.ok(name in claims, `README lost its <!-- claim:${name} --> marker`);
  }
});

test('runtime dependency count matches package.json', () => {
  const deps = Object.keys(JSON.parse(read('package.json')).dependencies || {}).length;
  assert.equal(numberIn(claims['runtime-deps']), deps);
});

test('runtime core size is within 15% of the tree', () => {
  const files = fs.readdirSync(path.join(ROOT, 'src/core')).filter((f) => f.endsWith('.js')).map((f) => `src/core/${f}`);
  const actual = [...files, 'src/shared/base-component.js'].reduce((n, p) => n + wcLines(p), 0);
  const claimed = numberIn(claims['core-lines']);
  assert.ok(within(claimed, actual, 0.15), `README says ~${claimed} lines; src/core + BaseComponent is ${actual}`);
});

test('router size is within 15% of the file', () => {
  const actual = wcLines('src/core/router.js');
  const claimed = numberIn(claims['router-lines']);
  assert.ok(within(claimed, actual, 0.15), `README says about ${claimed} lines; router.js is ${actual}`);
});

test('control count is exact', () => {
  const actual = fs.readdirSync(path.join(ROOT, 'src/shared/controls')).filter((f) => /^ax-.*\.js$/.test(f)).length;
  assert.equal(numberIn(claims.controls), actual);
});
