#!/usr/bin/env node
/**
 * tools/csp.js — a Content-Security-Policy <meta> for an Axiom index.html.
 *
 *   node tools/csp.js <index.html> --write  [--config <axiom-config.js>] [--connect <origin> ...]
 *   node tools/csp.js <index.html> --check  [--config …] [--connect …]
 *   node tools/csp.js <index.html> --print  [--config …] [--connect …]
 *
 * Why a tool and not a hand-written <meta>: CSP treats the inline import map as
 * inline script. The only way to allow it WITHOUT 'unsafe-inline' — which would
 * re-admit every injected <script> — is its sha256, and every step that rewrites
 * the map (the /axiom/ subpath rewrite, the build's dist paths and ?v= stamps)
 * changes that hash. So the hash is computed from the FINAL html, at the step
 * that produces it, and --check proves it is current.
 *
 * connect-src comes from the public runtime config (axiom-config.js), so the
 * policy follows the endpoints a deployment actually calls.
 *
 * Exit codes: 0 ok · 1 --check found the policy missing or stale · 2 usage or
 * input error — including an inline <script> other than the import map, which
 * the policy would block (move it to a file).
 */
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const IMPORT_MAP_RE = /<script\s+type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i;
const CSP_META_RE = /<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>/i;
const TURNSTILE = 'https://challenges.cloudflare.com';

// Comments are not markup: a comment that MENTIONS <script> must not read as one.
const stripComments = (html) => html.replace(/<!--[\s\S]*?-->/g, '');

export const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('base64');

/** The import map's inner text, exactly as the browser hashes it (whitespace included). */
export const importMapText = (html) => stripComments(html).match(IMPORT_MAP_RE)?.[1] ?? null;

/** Inline <script> elements other than the import map — each would be blocked. */
export const strayInlineScripts = (html) =>
  [...stripComments(html).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attrs, body]) => !/\bsrc\s*=/i.test(attrs) && !/type=["']importmap["']/i.test(attrs) && body.trim())
    .map(([tag]) => tag.slice(0, 80).replace(/\s+/g, ' '));

const originOf = (value) => {
  if (!value || typeof value !== 'string') return null;
  try { return new URL(value.includes('://') ? value : `https://${value}`).origin; } catch { return null; }
};

/** Origins the runtime config says the app will fetch from. */
export const connectOrigins = (cfg = {}) => {
  const out = new Set();
  for (const key of ['REST_ENDPOINT', 'NEXUS_URL', 'GRAPHQL_ENDPOINT', 'CONTENT_HOST']) {
    const o = originOf(cfg[key]);
    if (o) out.add(o);
  }
  const auth = cfg.AUTH || {};
  const pool = originOf(auth.USER_POOL_DOMAIN);
  if (pool) out.add(pool);                                              // Cognito token endpoint
  if (auth.GOOGLE_CLIENT_ID) out.add('https://lh3.googleusercontent.com'); // avatar fetch in auth.js
  return [...out].sort();
};

export const buildPolicy = ({ importMapHash = null, connect = [], turnstile = false } = {}) => [
  ['default-src', "'self'"],
  ['script-src', "'self'", importMapHash && `'sha256-${importMapHash}'`, turnstile && TURNSTILE],
  // Shadow templates still carry style="" attributes and two <style> blocks.
  // CSS injection is not script execution; tighten once those are gone.
  ['style-src', "'self'", "'unsafe-inline'"],
  ['img-src', "'self'", 'data:', 'https:'],
  ['font-src', "'self'", 'data:'],
  ['connect-src', "'self'", ...connect],
  turnstile && ['frame-src', TURNSTILE],
  ['object-src', "'none'"],
  ['base-uri', "'self'"],
  ['form-action', "'self'"],
  // No frame-ancestors: a <meta> policy ignores it and the browser logs an error.
  // Framing protection needs a real header (X-Frame-Options in _headers).
].filter(Boolean).map((d) => d.filter(Boolean).join(' ')).join('; ');

/** The policy currently in the file, or null. */
export const currentPolicy = (html) => html.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content="([^"]*)"/i)?.[1] ?? null;

/** Insert (directly after <meta charset>) or replace the policy <meta>. */
export const applyPolicy = (html, policy) => {
  const tag = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  if (CSP_META_RE.test(html)) return html.replace(CSP_META_RE, tag);
  // A CSP <meta> governs only what FOLLOWS it, so it goes first in <head>.
  const charset = html.match(/([ \t]*)<meta\s+charset=[^>]*>\n?/i);
  if (!charset) throw new Error('no <meta charset> to anchor the policy after');
  const at = charset.index + charset[0].length;
  return `${html.slice(0, at)}${charset[1]}${tag}\n${html.slice(at)}`;
};

/** window.AXIOM_CONFIG as the classic config script would leave it. */
export const readConfig = (file) => {
  if (!file || !fs.existsSync(file)) return {};
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file, timeout: 1000 });
  return sandbox.window.AXIOM_CONFIG || {};
};

export const main = (argv) => {
  const [file, ...rest] = argv;
  const mode = rest.find((a) => ['--write', '--check', '--print'].includes(a));
  if (!file || !mode) {
    console.error('usage: node tools/csp.js <index.html> --write|--check|--print [--config <file>] [--connect <origin> ...]');
    return 2;
  }
  const valueOf = (flag) => { const i = rest.indexOf(flag); return i >= 0 ? rest[i + 1] : undefined; };
  const extra = rest.flatMap((a, i) => (a === '--connect' ? [originOf(rest[i + 1])] : [])).filter(Boolean);

  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch (e) { console.error(`csp: cannot read ${file}: ${e.message}`); return 2; }

  const stray = strayInlineScripts(html);
  if (stray.length) {
    console.error(`csp: ${stray.length} inline <script> besides the import map — the policy would block it. Move it to a file:\n  ${stray.join('\n  ')}`);
    return 2;
  }

  let cfg;
  try { cfg = readConfig(valueOf('--config')); } catch (e) { console.error(`csp: cannot evaluate config: ${e.message}`); return 2; }
  const map = importMapText(html);
  const policy = buildPolicy({
    importMapHash: map === null ? null : sha256(map),
    connect: [...new Set([...connectOrigins(cfg), ...extra])].sort(),
    turnstile: Boolean(cfg.TURNSTILE_SITE_KEY || cfg.AUTH?.TURNSTILE_SITE_KEY),
  });

  if (mode === '--print') { console.log(policy); return 0; }
  if (mode === '--write') {
    fs.writeFileSync(file, applyPolicy(html, policy));
    console.log(`csp: policy written to ${file}`);
    return 0;
  }
  const have = currentPolicy(html);
  if (have === policy) { console.log('csp: policy present and current'); return 0; }
  console.error(have
    ? 'csp: policy is STALE — the import map or config changed since it was written; rerun with --write'
    : 'csp: no policy in this file; run with --write');
  return 1;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
