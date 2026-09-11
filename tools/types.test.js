import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stripInternal } from './types.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const run = (args) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });

test('stripInternal drops underscore members from namespaces and classes, keeping _esc and _delete', () => {
  const out = stripInternal(`export namespace a {
    let _x: number;
    function _y(): void;
    function z(): void;
    function _delete(): void;
    export { _delete as delete };
}
export class B {
    _refs: Map<any, any>;
    _esc(s: unknown): string;
    render(): void;
}
`);
  assert.doesNotMatch(out, /_x|_y|_refs/);
  for (const kept of [/function z/, /_delete/, /_esc/, /render/]) assert.match(out, kept);
});

test('committed types/ are exactly what src/ generates', () => {
  const r = run(['tools/types.js', '--check']);
  assert.equal(r.status, 0, r.stderr);
});

test('no internal member leaks into the public declarations', () => {
  const leaks = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        if (/^\s*(export\s+)?(static\s+)?(let|const|function|get)?\s*_(?!esc\b|delete\b)\w+\s*[(:?]/.test(line)) leaks.push(`${p}:${i + 1}: ${line.trim()}`);
      });
    }
  };
  walk(path.join(ROOT, 'types'));
  assert.deepEqual(leaks, []);
});

test('the contract compiles — and every misuse written into it is rejected', () => {
  // tests/types/contract.ts: each @ts-expect-error marks a misuse. If one ever
  // compiles, the unused directive is itself an error, so this fails.
  const tsc = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));
  const r = run([tsc, '-p', 'tsconfig.contract.json']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
