#!/usr/bin/env node
/**
 * tools/weigh.js — what the app actually ships, in bytes, checked against the README.
 *
 *   node tools/weigh.js            print the sizes (run `npm run build` first)
 *   node tools/weigh.js --check    exit 1 if a README weight claim is more than 10% off
 *   ... [--root <dir>]             weigh another tree (tests use this)
 *
 * Sizes cover JS + CSS. Compression is measured PER FILE, the way a browser
 * fetches modules. One archive of everything shares a dictionary across files
 * and flatters the result: the README's first "~57 KB gzipped" was measured that
 * way, and per file the same build is ~87 KB.
 *
 * Exit codes: 0 ok · 1 a claim drifted · 2 no dist/ to weigh, or a claim missing.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const TOLERANCE = 0.10;
export const WEIGHTS = ['source-kb', 'minified-kb', 'gzip-kb', 'brotli-kb'];

const walk = (dir) => (fs.existsSync(dir)
  ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
  : []);
const assets = (dir) => walk(dir).filter((f) => /\.(js|css)$/.test(f));
const total = (files, measure) => files.reduce((n, f) => n + measure(fs.readFileSync(f)), 0) / 1024;

/** KB of JS + CSS: raw source, minified dist, and dist compressed per file. */
export const weigh = (root) => {
  const src = assets(path.join(root, 'src'));
  const dist = assets(path.join(root, 'dist'));
  return {
    'source-kb': total(src, (b) => b.length),
    'minified-kb': total(dist, (b) => b.length),
    'gzip-kb': total(dist, (b) => zlib.gzipSync(b, { level: 6 }).length),
    'brotli-kb': total(dist, (b) => zlib.brotliCompressSync(b).length),
  };
};

/** Every <!-- claim:NAME -->…<!-- /claim --> in a README, as numbers. */
export const readClaims = (text) => Object.fromEntries(
  [...text.matchAll(/<!-- claim:([\w-]+) -->([\s\S]*?)<!-- \/claim -->/g)].map(([, name, body]) => [name, Number(body.replace(/[^\d.]/g, ''))])
);

export const compare = (claims, measured) => WEIGHTS.map((name) => ({
  name,
  claimed: claims[name],
  actual: measured[name],
  off: name in claims ? Math.abs(claims[name] - measured[name]) / measured[name] : null,
}));

const main = (argv) => {
  const i = argv.indexOf('--root');
  const root = path.resolve(i >= 0 ? argv[i + 1] : fileURLToPath(new URL('..', import.meta.url)));
  if (!assets(path.join(root, 'dist')).length) {
    console.error('weigh: no dist/ to weigh — run `npm run build` first');
    return 2;
  }
  const rows = compare(readClaims(fs.readFileSync(path.join(root, 'README.md'), 'utf8')), weigh(root));
  for (const r of rows) {
    const verdict = r.off === null ? 'NOT CLAIMED' : r.off > TOLERANCE ? `DRIFTED ${(r.off * 100).toFixed(0)}%` : 'ok';
    console.log(`${r.name.padEnd(12)} actual ${r.actual.toFixed(1).padStart(6)} KB   README ${String(r.claimed ?? '—').padStart(4)}   ${verdict}`);
  }
  if (!argv.includes('--check')) return 0;
  if (rows.some((r) => r.off === null)) { console.error('weigh: the README lost a weight claim marker'); return 2; }
  const drifted = rows.filter((r) => r.off > TOLERANCE);
  if (drifted.length) { console.error(`weigh: ${drifted.length} README weight claim(s) drifted past ${TOLERANCE * 100}% — update the README`); return 1; }
  return 0;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
