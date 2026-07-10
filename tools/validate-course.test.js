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

test('the REAL data/scobot.json validates (schemas describe reality)', () => {
  const real = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'data', 'scobot.json');
  const r = validateCourse(real);
  assert.deepEqual(r.errors, []);
});

test('match: pair missing targetText fails with a path', () => {
  const bad = structuredClone(MINIMAL_COURSE);
  bad.pages = [{
    id: 'm1', type: 'match', title: 'M', question: 'Match:',
    pairs: [
      { sourceId: 's1', sourceText: 'A', targetId: 't1', targetText: 'B' },
      { sourceId: 's2', sourceText: 'C', targetId: 't2' }
    ]
  }];
  const r = validateCourse(writeCourse('match-bad.json', bad));
  assert.ok(r.errors.some(e => e.includes('pages[0]') && e.includes('targetText')), r.errors.join('\n'));
});

test('wordpuzzle: blank with empty answers fails', () => {
  const bad = structuredClone(MINIMAL_COURSE);
  bad.pages = [{
    id: 'w1', type: 'wordpuzzle', title: 'W', question: 'Fill:',
    text: 'x {{b1}}', blanks: [{ id: 'b1', answers: [] }]
  }];
  const r = validateCourse(writeCourse('wp-bad.json', bad));
  assert.ok(r.errors.some(e => e.includes('answers')), r.errors.join('\n'));
});

test('duplicate page ids fail', () => {
  const bad = structuredClone(MINIMAL_COURSE);
  bad.pages = [structuredClone(VALID_CHOICE_PAGE), structuredClone(VALID_CHOICE_PAGE)];
  const r = validateCourse(writeCourse('dupe.json', bad));
  assert.ok(r.errors.some(e => e.includes('duplicates')), r.errors.join('\n'));
});

test('course: meta.title is required', () => {
  const bad = structuredClone(MINIMAL_COURSE);
  delete bad.meta.title;
  const r = validateCourse(writeCourse('meta-bad.json', bad));
  assert.ok(r.errors.some(e => e.startsWith('course') && e.includes('title')), r.errors.join('\n'));
});

test('answersToConfirm lists choice keys, match pairs, blanks, weights, passing scores', () => {
  const course = {
    meta: { title: 'T', passingScore: 80 },
    settings: {},
    pages: [
      structuredClone(VALID_CHOICE_PAGE),
      { id: 'm1', type: 'match', title: 'M', question: 'q', weight: 2,
        pairs: [
          { sourceId: 's1', sourceText: 'Shadow DOM', targetId: 't1', targetText: 'Encapsulation' },
          { sourceId: 's2', sourceText: 'ESM', targetId: 't2', targetText: 'Modules' }
        ] },
      { id: 'w1', type: 'wordpuzzle', title: 'W', question: 'q', text: 'x {{b1}}',
        blanks: [{ id: 'b1', answers: ['HTMLElement'] }] }
    ]
  };
  const r = validateCourse(writeCourse('keys.json', course));
  const joined = r.answersToConfirm.join('\n');
  assert.ok(joined.includes('meta.passingScore = 80'));
  assert.ok(joined.includes('q-sample') && joined.includes('"Right"'));
  assert.ok(joined.includes('m1') && joined.includes('Shadow DOM → Encapsulation'));
  assert.ok(joined.includes('w1') && joined.includes('HTMLElement'));
  assert.ok(joined.includes('weight = 2'));
});

test('every golden example page validates under its schema; examples/course.json validates whole', () => {
  const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
  for (const type of PAGE_TYPES) {
    const page = JSON.parse(fs.readFileSync(path.join(root, 'examples', `${type}.json`), 'utf8'));
    const course = { meta: { title: 'X' }, settings: {}, pages: [page] };
    const r = validateCourse(writeCourse(`example-${type}.json`, course));
    assert.deepEqual(r.errors, [], `${type} example invalid`);
  }
  const r = validateCourse(path.join(root, 'examples', 'course.json'));
  assert.deepEqual(r.errors, []);
});
