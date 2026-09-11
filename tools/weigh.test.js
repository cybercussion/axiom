import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { weigh, readClaims, compare, TOLERANCE } from './weigh.js';

const CLI = fileURLToPath(new URL('./weigh.js', import.meta.url));
const tree = (readme, { dist = true } = {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'weigh-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src', 'a.js'), `export const a = ${JSON.stringify('x'.repeat(4000))};\n`);
  if (dist) {
    fs.mkdirSync(path.join(root, 'dist'));
    fs.writeFileSync(path.join(root, 'dist', 'a.js'), `export const a="${'x'.repeat(3000)}";`);
  }
  fs.writeFileSync(path.join(root, 'README.md'), readme);
  return root;
};
const marked = (m) => Object.entries(m).map(([k, v]) => `<!-- claim:${k} -->${v}<!-- /claim -->`).join(' ');

test('compression is measured per file, not as one archive', () => {
  const root = tree('');
  const buf = fs.readFileSync(path.join(root, 'dist', 'a.js'));
  assert.equal(weigh(root)['gzip-kb'], zlib.gzipSync(buf, { level: 6 }).length / 1024);
});

test('claims are read from the invisible markers', () => {
  assert.deepEqual(readClaims('x <!-- claim:gzip-kb -->~87<!-- /claim --> y'), { 'gzip-kb': 87 });
});

test('a claim within tolerance passes; one past it is flagged', () => {
  const measured = { 'source-kb': 100, 'minified-kb': 50, 'gzip-kb': 20, 'brotli-kb': 10 };
  const ok = compare({ 'source-kb': 105, 'minified-kb': 50, 'gzip-kb': 20, 'brotli-kb': 10 }, measured);
  assert.ok(ok.every((r) => r.off <= TOLERANCE));
  const bad = compare({ 'source-kb': 100, 'minified-kb': 50, 'gzip-kb': 13, 'brotli-kb': 10 }, measured);
  assert.deepEqual(bad.filter((r) => r.off > TOLERANCE).map((r) => r.name), ['gzip-kb']);
});

test('CLI: exit 0 when current, 1 when a claim drifted, 2 with no dist/', () => {
  const measured = weigh(tree(''));
  const exact = Object.fromEntries(Object.entries(measured).map(([k, v]) => [k, v.toFixed(2)]));
  const run = (root) => spawnSync(process.execPath, [CLI, '--check', '--root', root], { encoding: 'utf8' }).status;
  assert.equal(run(tree(marked(exact))), 0);
  assert.equal(run(tree(marked({ ...exact, 'gzip-kb': (measured['gzip-kb'] * 2).toFixed(2) }))), 1);
  assert.equal(run(tree(marked(exact), { dist: false })), 2);
});
