/**
 * Cache policy in the _headers TEMPLATE every Axiom-based project inherits.
 *
 * Modules are versioned by QUERY (?v=BUILD_ID), and Cloudflare serves files by
 * path, ignoring the query. During a deploy's propagation window a browser can
 * receive OLD bytes for a NEW url; `immutable` pins them for a year, and the app
 * runs two module graphs — daystra's 2026-09-12 login outage (relayed on
 * #scobot.cybercussion.com seq 18). Code therefore revalidates (ETag 304s), as
 * docs/patterns/stale-deploy-prevention.md prescribes for Workers Assets.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = {};
let current = null;
for (const line of readFileSync(new URL('../_headers', import.meta.url), 'utf8').split('\n')) {
  if (line.startsWith('/')) current = line.trim();
  else if (current && line.trim().startsWith('Cache-Control:')) rules[current] = line.split('Cache-Control:')[1].trim();
}

const CODE = ['/app.js', '/app-routes.js', '/core/*', '/shared/*', '/features/*'];

test('query-versioned code is never immutable — it revalidates', () => {
  for (const path of CODE) {
    assert.ok(rules[path], `${path} has a Cache-Control rule`);
    assert.doesNotMatch(rules[path], /immutable/, path);
    assert.match(rules[path], /max-age=0/, path);
    assert.match(rules[path], /must-revalidate/, path);
  }
});

test('HTML and the SPA-fallback catch-all are never stored', () => {
  for (const path of ['/*', '/', '/index.html']) assert.match(rules[path], /no-store/, path);
});
