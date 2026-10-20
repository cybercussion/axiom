import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampImports, stampRoutePaths, withVersion, readNamespaceMap, readExactAliasMap, staticImports, moduleClosure, injectModulePreload } from './minify.js';

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

// modulepreload: the startup graph is the STATIC import closure; dynamic import() loads on demand.
// Ported from a downstream project, where it took the startup graph from 12 waves to 1.
test('staticImports reads every static form terser emits and skips dynamic import()', () => {
  const code = 'import"./a.js?v=1";import{b as c}from"/core/b.js?v=1";import*as d from"../d.js?v=1";'
    + 'export{e}from"./e.js?v=1";export*from"./f.js?v=1";const g=()=>import("./lazy.js?v=1");x.import("no");';
  assert.deepEqual(staticImports(code), ['./a.js?v=1', '/core/b.js?v=1', '../d.js?v=1', './e.js?v=1', './f.js?v=1']);
});

test('moduleClosure resolves specifiers against their importer and visits each module once', () => {
  const files = {
    '/app.js': 'import"./x/a.js?v=1";import{b}from"/core/b.js?v=1"',
    '/x/a.js': 'import{b}from"../core/b.js?v=1";const l=()=>import("./lazy.js?v=1")',
    '/core/b.js': 'export const b=1',
  };
  const read = (p) => { if (!(p in files)) throw new Error(`missing ${p}`); return files[p]; };
  assert.deepEqual(moduleClosure(['/app.js?v=1'], read), ['/app.js?v=1', '/x/a.js?v=1', '/core/b.js?v=1']);
});

test('moduleClosure refuses a bare specifier, even one the import map would resolve', () => {
  // Cloudflare re-emits modulepreload as a Link: header, so the browser resolves a preloaded
  // module's imports before the map exists. Mapped is not enough.
  const files = { '/app.js': 'import{r}from"/core/router.js?v=1"', '/core/router.js': 'import{state}from"@state"' };
  assert.throws(() => moduleClosure(['/app.js'], (p) => files[p]), /bare specifier "@state" in \/core\/router\.js\?v=1/);
  assert.throws(() => moduleClosure(['/app.js'], () => 'import"three"'), /cannot depend on the import map/);
});

test('moduleClosure skips a full URL to another host', () => {
  const files = { '/app.js': 'import"https://cdn.example/x.js";import"./a.js"', '/a.js': '' };
  assert.deepEqual(moduleClosure(['/app.js'], (p) => files[p]), ['/app.js', '/a.js']);
});

test('injectModulePreload puts the links after the import map, before the first module script', () => {
  const html = '<head>\n  <script type="importmap">{}</script>\n</head>\n<body>\n  <script type="module" src="/app.js?v=1"></script>\n</body>';
  const out = injectModulePreload(html, ['/core/a.js?v=1', '/core/b.js?v=1']);
  const map = out.indexOf('type="importmap"'), first = out.indexOf('rel="modulepreload"'), entry = out.indexOf('type="module"');
  assert.ok(map < first && first < entry, out);
  assert.equal(out.match(/rel="modulepreload"/g).length, 2);
});

test('injectModulePreload refuses when a module script precedes the import map (the resolver race)', () => {
  const html = '<script type="module" src="/app.js?v=1"></script>\n<script type="importmap">{}</script>';
  assert.throws(() => injectModulePreload(html, ['/core/a.js?v=1']), /import map must precede/);
});
