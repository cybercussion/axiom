import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { validateCourse, PAGE_TYPES } from './validate-course.js';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-course-'));

function writeCourse(name, obj) {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
  return p;
}

const VALID_CHOICE_PAGE = {
  id: 'q-sample',
  type: 'choice',
  title: 'Sample',
  question: 'Pick one:',
  multiSelect: false,
  choices: [
    { id: 'a', text: 'Right', correct: true },
    { id: 'b', text: 'Wrong', correct: false }
  ],
  weight: 1
};

const MINIMAL_COURSE = {
  meta: { title: 'T' },
  settings: {},
  pages: [VALID_CHOICE_PAGE]
};

test('a minimal valid course passes', () => {
  const r = validateCourse(writeCourse('ok.json', MINIMAL_COURSE));
  assert.deepEqual(r.errors, []);
  assert.equal(r.valid, true);
});

test('missing required field produces a field-level error path', () => {
  const bad = structuredClone(MINIMAL_COURSE);
  delete bad.pages[0].question;
  const r = validateCourse(writeCourse('missing.json', bad));
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.includes("pages[0]") && e.includes('question')), r.errors.join('\n'));
});

test('unknown page type names the allowed types', () => {
  const bad = structuredClone(MINIMAL_COURSE);
  bad.pages[0].type = 'essay';
  const r = validateCourse(writeCourse('unknown.json', bad));
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.includes('essay') && PAGE_TYPES.every(t => e.includes(t))), r.errors.join('\n'));
});

test('unreadable file is a clean error, not a throw', () => {
  const r = validateCourse(path.join(TMP, 'nope.json'));
  assert.equal(r.valid, false);
  assert.equal(r.errors.length, 1);
});
