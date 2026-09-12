#!/usr/bin/env node
/**
 * tools/fleet-smoke.js — does this app still boot after a core re-borrow?
 *
 *   node tools/fleet-smoke.js --root ../some-project [--routes /,/about,/login] [--port 4212]
 *
 * Serves the tree with tools/serve.js and visits each route in Chromium. For
 * each it reports the element that mounted, the document title, whether the
 * component's shadow root actually got the theme, and anything the page logged
 * as an error (the logger prints every level through console.log, so its ERROR
 * lines count too). Exit 1 if a route mounts nothing or logs an error.
 *
 * Run it against the untouched tree FIRST and keep the output: the re-borrow is
 * behaviour-neutral only if the two runs match. A route whose feature module is
 * missing (an unknown path) logs its 404 fallback in both runs — that is the
 * router's contract, not a regression.
 *
 * Playwright resolves from axiom's node_modules, so run this from axiom.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/* global document */

const arg = (flag, fallback) => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : fallback; };
const root = path.resolve(arg('--root', '.'));
const port = Number(arg('--port', 4212));
const routes = arg('--routes', '/').split(',').map((r) => r.trim()).filter(Boolean);
const serve = fileURLToPath(new URL('./serve.js', import.meta.url));

const server = spawn(process.execPath, [serve, '--root', root, '--port', String(port)], { cwd: root });
await new Promise((resolve, reject) => {
  server.stdout.once('data', resolve);
  server.once('error', reject);
});

const browser = await chromium.launch();
let failures = 0;
try {
  for (const route of routes) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const problems = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' || m.text().includes('[Axiom::ERROR]')) problems.push(`console: ${m.text().slice(0, 140)}`);
    });
    await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'domcontentloaded' });
    let mounted = '(nothing)';
    try {
      await page.waitForFunction(() => {
        const el = document.querySelector('#app-container > *');
        return el && el.tagName.toLowerCase().endsWith('-ui') && el.shadowRoot?.childElementCount > 0;
      }, null, { timeout: 8000 });
      mounted = await page.evaluate(() => document.querySelector('#app-container > *').tagName.toLowerCase());
    } catch { /* reported as a failure below */ }
    const themed = await page.evaluate(() => {
      const sheet = document.querySelector('#app-container > *')?.shadowRoot?.adoptedStyleSheets?.[0];
      return sheet ? sheet.cssRules.length > 0 : null;
    });
    const title = await page.title();
    if (mounted === '(nothing)' || problems.length) failures += 1;
    console.log(`${route.padEnd(22)} ${mounted.padEnd(18)} theme=${String(themed).padEnd(5)} title=${JSON.stringify(title)}`);
    for (const p of problems.slice(0, 3)) console.log(`    ${p}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(failures ? `\n${failures} route(s) failed` : '\nall routes booted clean');
process.exit(failures ? 1 : 0);
