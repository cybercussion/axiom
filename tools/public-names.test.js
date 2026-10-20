/**
 * The public repo names no downstream project and no fleet channel.
 *
 * This repository is public and its Pages deploy serves docs/ as a website. The
 * names were scrubbed once (49957a3, 2026-09-12) and fifteen came back within five
 * weeks, through provenance comments ("relayed from …") written by later fixes.
 * Credit the fix as "a downstream project"; the record of whose it was lives with
 * the fleet notes, outside this repo.
 *
 * Not scanned: AGENTS.md and .claude/ (fleet tooling and product URLs, kept by
 * operator call) and docs/superpowers/ (process history, kept by the same scrub).
 * Falsifier: if the operator rules that naming downstream projects here is fine,
 * this test is ceremony — delete it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// What git would publish: tracked files plus new ones not ignored (docs/private/ is ignored).
const SCANNED = ['src', 'tools', 'tests', 'types', 'docs', 'public', '.github',
  'README.md', 'CHANGELOG.md', 'SECURITY.md', 'MANIFEST.toml', 'index.html', '_headers', 'manifest.json', 'package.json'];
const SKIPPED = ['docs/superpowers/', 'tools/public-names.test.js'];
const TEXT = new Set(['.js', '.mjs', '.ts', '.css', '.html', '.md', '.json', '.toml', '.yml', '.yaml', '.txt', '']);
const NAMES = /\b(waketrace|daystra|daystrom|scobot|tender|stng|specula|kyber)\b|#(axiom|fleet|wire)\b|\bseq \d+\b/i;

test('no public file names a downstream project or a fleet channel', () => {
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...SCANNED], { cwd: ROOT, encoding: 'utf8' })
    .split('\0')
    .filter((rel) => rel && TEXT.has(path.extname(rel)) && !SKIPPED.some((s) => rel.startsWith(s)) && fs.existsSync(path.join(ROOT, rel)));
  assert.ok(files.length > 50, `scanned only ${files.length} files — the listing is broken`);
  const hits = [];
  for (const rel of files) {
    fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n').forEach((line, i) => {
      const m = line.match(NAMES);
      if (m) hits.push(`${rel}:${i + 1}  "${m[0]}"`);
    });
  }
  assert.deepEqual(hits, [], `write "a downstream project" instead:\n${hits.join('\n')}`);
});
