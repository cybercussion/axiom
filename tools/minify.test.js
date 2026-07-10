import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampImports, stampRoutePaths, withVersion, readNamespaceMap, readExactAliasMap } from './minify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Alias → absolute dist target. Prefix maps with relative address values won't resolve a
// specifier carrying a ?query, so the build resolves aliases to absolute paths + ?v=.
const MAP = { '@core/': '/core/', '@shared/': '/shared/', '@features/': '/features/' };
// Exact (non-slash) aliases like @state resolve to an absolute dist path too, so the built JS
// carries NO bare specifier that still depends on the runtime import map.
const EXACT = { '@state': '/core/state.js' };

test('stampImports resolves namespace aliases to absolute versioned paths', () => {
  const code = [
    'import {router} from "@core/router.js";',
    'import {nav} from "@features/navigation/nav-orchestrator.js";',
    'import {x} from "@shared/base-component.js";'
  ].join('\n');
  const out = stampImports(code, 'abc123', MAP);
  assert.match(out, /from "\/core\/router\.js\?v=abc123"/);
  assert.match(out, /from "\/features\/navigation\/nav-orchestrator\.js\?v=abc123"/);
  assert.match(out, /from "\/shared\/base-component\.js\?v=abc123"/);
  // The bare alias must NOT survive (that's the form browsers can't resolve with a query).
  assert.doesNotMatch(out, /@core\/router\.js\?v=/);
});

test('stampImports still cache-busts relative/absolute path imports (regression)', () => {
  const code = 'import {R} from "./app-routes.js";\nimport "/core/logger.js";';
  const out = stampImports(code, 'abc123', MAP);
  assert.match(out, /"\.\/app-routes\.js\?v=abc123"/);
  assert.match(out, /"\/core\/logger\.js\?v=abc123"/);
});

test('stampImports resolves dynamic namespace imports to absolute versioned paths', () => {
  const out = stampImports('const m = await import("@features/dashboard/dashboard-api.js");', 'abc123', MAP);
  assert.match(out, /import\("\/features\/dashboard\/dashboard-api\.js\?v=abc123"\)/);
});

test('stampImports resolves the @state exact alias to an absolute versioned path', () => {
  // @state has no ".js" suffix, so it was previously left bare — the ONLY specifier in the built
  // bundle still depending on the runtime import map, and the cause of intermittent
  // "Failed to resolve module specifier @state" on cold loads. It must now resolve like a path.
  const out = stampImports('import {state} from "@state";', 'abc123', MAP, EXACT);
  assert.match(out, /from "\/core\/state\.js\?v=abc123"/);
  assert.doesNotMatch(out, /"@state"/);
});

test('stampImports resolves @state inside a dynamic import() too', () => {
  const out = stampImports('const s = await import("@state");', 'abc123', MAP, EXACT);
  assert.match(out, /import\("\/core\/state\.js\?v=abc123"\)/);
});

test('stampImports does not double-stamp an already-versioned specifier', () => {
  const code = 'import {R} from "./app-routes.js?v=old";';
  assert.equal(stampImports(code, 'abc123', MAP), code);
});

test('stampImports leaves unknown bare specifiers untouched', () => {
  const code = 'import {z} from "some-pkg/thing.js";';
  assert.equal(stampImports(code, 'abc123', MAP), code);
});

test('stampRoutePaths resolves ROUTES path: aliases to absolute versioned paths', () => {
  const code = "export const ROUTES = {\n  'home': { path: '@features/home/home.js' },\n  'counter': { path: \"@features/counter/counter.js\" }\n};";
  const out = stampRoutePaths(code, 'abc123', MAP);
  assert.match(out, /path: '\/features\/home\/home\.js\?v=abc123'/);
  assert.match(out, /path: "\/features\/counter\/counter\.js\?v=abc123"/);
  assert.doesNotMatch(out, /@features\/home\/home\.js\?v=/);
});

test('stampRoutePaths does not double-stamp an already-versioned path', () => {
  const code = "{ path: '/features/home/home.js?v=old' }";
  assert.equal(stampRoutePaths(code, 'abc123', MAP), code);
});

test('stampRoutePaths ignores import/from statements (only object path: values)', () => {
  const code = "import {x} from '@core/router.js';";
  assert.equal(stampRoutePaths(code, 'abc123', MAP), code);
});

test('withVersion: paths get ?v=, aliases resolve to absolute path + ?v=, others untouched', () => {
  assert.equal(withVersion('./x.js', 'b', MAP), './x.js?v=b');
  assert.equal(withVersion('/core/x.js', 'b', MAP), '/core/x.js?v=b');
  assert.equal(withVersion('@core/x.js', 'b', MAP), '/core/x.js?v=b');
  assert.equal(withVersion('@features/a/b.js', 'b', MAP), '/features/a/b.js?v=b');
  assert.equal(withVersion('@state', 'b', MAP, EXACT), '/core/state.js?v=b');
  assert.equal(withVersion('some-pkg/x.js', 'b', MAP), 'some-pkg/x.js');
  assert.equal(withVersion('./x.js?v=old', 'b', MAP), './x.js?v=old');
});

test('readNamespaceMap maps trailing-slash aliases to absolute dist paths, excluding @state', () => {
  const map = readNamespaceMap(path.join(__dirname, '..', 'index.html'));
  assert.equal(map['@core/'], '/core/');
  assert.equal(map['@shared/'], '/shared/');
  assert.equal(map['@features/'], '/features/');
  assert.ok(!('@state' in map));
});

test('readExactAliasMap maps exact aliases like @state to absolute dist paths, excluding prefixes', () => {
  const map = readExactAliasMap(path.join(__dirname, '..', 'index.html'));
  assert.equal(map['@state'], '/core/state.js');
  assert.ok(!('@core/' in map));
});
