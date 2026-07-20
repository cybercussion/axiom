#!/usr/bin/env node
/**
 * Motion gate — makes the "no literal easings/durations" rule executable.
 *
 * Rules (see the token block in src/shared/styles/theme.css):
 *  1. No `cubic-bezier(` anywhere in src/ outside theme.css.
 *  2. No literal ms/s duration in a transition/animation declaration —
 *     durations come from var(--duration-*).
 * A line carrying a `motion-gate: allow` comment is a sanctioned exception
 * (infinite ambient loops, route-progress's intentional crawl).
 *
 * Wired into `npm run build` so a violation fails the build; also runnable
 * standalone via `npm run lint:motion`.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SRC = join(ROOT, 'src');
const TOKEN_HOME = join('src', 'shared', 'styles', 'theme.css');
const DURATION_RE = /(transition|animation)[^;{]*[0-9]+(\.[0-9]+)?m?s/;

const files = [];
const walk = dir => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(js|css)$/.test(name)) files.push(full);
  }
};
walk(SRC);

const violations = [];
for (const file of files) {
  const rel = relative(ROOT, file);
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.includes('motion-gate: allow')) return;
    if (line.includes('cubic-bezier(') && rel !== TOKEN_HOME) {
      violations.push(`${rel}:${i + 1}: literal cubic-bezier outside the token block\n    ${line.trim()}`);
    }
    if (DURATION_RE.test(line) && !line.includes('var(--duration')) {
      violations.push(`${rel}:${i + 1}: literal duration in transition/animation declaration\n    ${line.trim()}`);
    }
  });
}

if (violations.length) {
  console.error(`\n❌ Motion gate: ${violations.length} violation(s)\n`);
  for (const v of violations) console.error('  ' + v);
  console.error('\nUse the motion tokens (var(--duration-*), var(--ease-*)); tag sanctioned\ninfinite loops with a `motion-gate: allow` comment on the line.\n');
  process.exit(1);
}
console.log(`✅ Motion gate clean (${files.length} files).`);
