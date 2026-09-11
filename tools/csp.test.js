import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { importMapText, sha256, buildPolicy, applyPolicy, connectOrigins, strayInlineScripts } from './csp.js';

const HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>t</title>
  <script type="importmap">
    { "imports": { "@state": "/src/core/state.js" } }
  </script>
</head>
<body><script type="module" src="src/app.js"></script></body>
</html>
`;

test('hashes the import map as the browser does: inner text, whitespace included', () => {
  const inner = importMapText(HTML);
  assert.ok(inner.startsWith('\n    {') && inner.endsWith('}\n  '));
  assert.equal(sha256(inner), createHash('sha256').update(inner).digest('base64'));
});

test("script-src allows the import map by hash — never by 'unsafe-inline'", () => {
  const p = buildPolicy({ importMapHash: 'abc=' });
  const scriptSrc = p.split('; ').find((d) => d.startsWith('script-src'));
  assert.equal(scriptSrc, "script-src 'self' 'sha256-abc='");
  assert.ok(p.includes("object-src 'none'") && p.includes("base-uri 'self'"));
  assert.ok(!p.includes('frame-ancestors'), 'ignored in a <meta>, and the browser logs an error for it');
});

test('the policy lands directly after <meta charset>; rewriting replaces it', () => {
  const once = applyPolicy(HTML, "default-src 'self'");
  const lines = once.split('\n');
  const i = lines.findIndex((l) => l.includes('charset'));
  assert.match(lines[i + 1], /^\s+<meta http-equiv="Content-Security-Policy"/);
  const twice = applyPolicy(once, "default-src 'none'");
  assert.equal(twice.match(/Content-Security-Policy/g).length, 1);
  assert.ok(twice.includes(`content="default-src 'none'"`));
});

test('connect-src follows the runtime config', () => {
  assert.deepEqual(connectOrigins({
    REST_ENDPOINT: 'https://api.example.com/v1',
    GRAPHQL_ENDPOINT: 'https://gql.example.com/graphql',
    AUTH: { USER_POOL_DOMAIN: 'auth.example.com', GOOGLE_CLIENT_ID: 'x' },
  }), ['https://api.example.com', 'https://auth.example.com', 'https://gql.example.com', 'https://lh3.googleusercontent.com']);
  assert.deepEqual(connectOrigins({}), []);
});

test('an inline script other than the import map is reported — the policy would block it', () => {
  assert.deepEqual(strayInlineScripts(HTML), []);
  assert.equal(strayInlineScripts(HTML.replace('</head>', '<script>window.x = 1</script></head>')).length, 1);
});

test('CLI: --check exits 1 without a policy, 0 after --write, 1 again once the import map changes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csp-'));
  const file = path.join(dir, 'index.html');
  fs.writeFileSync(file, HTML);
  const run = (...a) => spawnSync(process.execPath, [fileURLToPath(new URL('./csp.js', import.meta.url)), file, ...a], { encoding: 'utf8' });
  assert.equal(run('--check').status, 1);
  assert.equal(run('--write').status, 0);
  assert.equal(run('--check').status, 0);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('/src/core/state.js', '/axiom/src/core/state.js'));
  const stale = run('--check');
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /STALE/);
  assert.equal(run().status, 2, 'usage error');
});

test('an HTML comment that mentions <script> is not an inline script', () => {
  // index.html explains its load order in a comment ("its module <script> below").
  // The first draft of this tool read that as an inline script and refused the page.
  const commented = HTML.replace('<title>t</title>', '<title>t</title>\n  <!-- the app loads via its module <script> below -->');
  assert.deepEqual(strayInlineScripts(commented), []);
});

test('the real index.html is policy-ready: an import map, no stray inline script', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(importMapText(html));
  assert.deepEqual(strayInlineScripts(html), []);
});

test('src/ has no inline event handlers and no eval — the policy blocks both', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith('.js')) {
        fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
          if (/\son[a-z]+\s*=\s*["']/.test(line) || /\beval\(|new Function\(/.test(line)) offenders.push(`${p}:${i + 1}`);
        });
      }
    }
  };
  walk(fileURLToPath(new URL('../src', import.meta.url)));
  assert.deepEqual(offenders, []);
});
