#!/usr/bin/env node
/**
 * tools/serve.js — a zero-dependency static server for local work and tests.
 *
 *   node tools/serve.js [--port 3000] [--root .] [--csp]
 *
 * - SPA fallback: an extensionless path that is not a file serves index.html,
 *   so deep links like /dashboard load.
 * - Cache-Control: no-store. A verification against cached modules proves nothing.
 * - --csp serves index.html with the production Content-Security-Policy injected
 *   (tools/csp.js policyFor), so the app can be exercised under the policy it
 *   actually ships with — which is what the browser tests do.
 * - Binds 127.0.0.1 only.
 *
 * Exit codes: 0 on SIGINT/SIGTERM · 2 on a bad argument or a port already in use.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyPolicy, policyFor, readConfig } from './csp.js';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

export const createServer = ({ root = '.', csp = false } = {}) => {
  const rootAbs = path.resolve(root);
  const indexHtml = () => {
    const html = fs.readFileSync(path.join(rootAbs, 'index.html'), 'utf8');
    return csp ? applyPolicy(html, policyFor(html, readConfig(path.join(rootAbs, 'axiom-config.js')))) : html;
  };
  return http.createServer((req, res) => {
    const send = (status, body, type) => {
      res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(body);
    };
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname); } catch { return send(400, 'bad request', TYPES['.txt']); }
    const file = path.join(rootAbs, pathname);
    if (file !== rootAbs && !file.startsWith(rootAbs + path.sep)) return send(403, 'forbidden', TYPES['.txt']);

    const wantsIndex = pathname === '/' || pathname === '/index.html' || (!path.extname(pathname) && !isFile(file));
    if (wantsIndex) return send(200, indexHtml(), TYPES['.html']);
    if (!isFile(file)) return send(404, 'not found', TYPES['.txt']);
    return send(200, fs.readFileSync(file), TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
  });
};

const main = (argv) => {
  const valueOf = (flag, fallback) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : fallback; };
  const port = Number(valueOf('--port', 3000));
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error('serve: --port must be an integer 0-65535');
    return 2;
  }
  const csp = argv.includes('--csp');
  const server = createServer({ root: valueOf('--root', '.'), csp });
  server.on('error', (e) => { console.error(`serve: ${e.message}`); process.exit(2); });
  server.listen(port, '127.0.0.1', () => {
    console.log(`serve: http://127.0.0.1:${server.address().port}/${csp ? '  (production CSP)' : ''}`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  return undefined;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const code = main(process.argv.slice(2));
  if (code !== undefined) process.exitCode = code;
}
