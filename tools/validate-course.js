/**
 * Project Axiom: Course Validator (scrybe pattern — lean port)
 * Validates data/scobot.json against schemas/: one compiled Ajv validator
 * per page type, routed by page.type (NOT a oneOf union — clearer errors),
 * plus JS-level checks JSON Schema can't express (duplicate page ids).
 * Pattern origin: ~/cybercussion.com/scrybe templates/validate.js.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import Ajv2020Module from 'ajv/dist/2020.js';
// Ajv ships CJS; under node ESM interop the class may sit on .default.
const Ajv2020 = Ajv2020Module.default ?? Ajv2020Module;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SCHEMA_DIR = path.join(ROOT_DIR, 'schemas');

// Page types with a schema file present. Task 2 completes the set;
// keep this list in sync with TEMPLATE_REGISTRY in src/features/player/player.js.
export const PAGE_TYPES = fs.readdirSync(SCHEMA_DIR)
  .filter(f => f.endsWith('.schema.json') && !['page-base.schema.json', 'course.schema.json'].includes(f))
  .map(f => f.replace('.schema.json', ''))
  .sort();

function loadSchema(name) {
  return JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, `${name}.schema.json`), 'utf8'));
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addSchema(loadSchema('page-base'));
const pageValidators = {};
for (const type of PAGE_TYPES) {
  pageValidators[type] = ajv.compile(loadSchema(type));
}
let courseValidator = null;
if (fs.existsSync(path.join(SCHEMA_DIR, 'course.schema.json'))) {
  courseValidator = ajv.compile(loadSchema('course'));
}

function formatErrors(prefix, ajvErrors) {
  return (ajvErrors || []).map(e => {
    // unevaluatedProperties/additionalProperties errors don't name the
    // offending key in e.message — surface it from e.params so a typo'd
    // field (e.g. "wieght") is actually identifiable in the output.
    const badProp = e.params?.unevaluatedProperty ?? e.params?.additionalProperty;
    const suffix = badProp ? ` (property: "${badProp}")` : '';
    return `${prefix}${e.instancePath || ''} ${e.message}${suffix}`.trim();
  });
}

/**
 * @param {string} filePath course JSON path
 * @returns {{ valid: boolean, errors: string[], answersToConfirm: string[] }}
 */
export function validateCourse(filePath) {
  let course;
  try {
    course = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return { valid: false, errors: [`cannot read/parse ${filePath}: ${err.message}`], answersToConfirm: [] };
  }

  const errors = [];

  if (courseValidator && !courseValidator(course)) {
    errors.push(...formatErrors('course', courseValidator.errors));
  }

  const pages = Array.isArray(course.pages) ? course.pages : [];
  const seenIds = new Set();
  pages.forEach((page, i) => {
    const where = `pages[${i}]`;
    const type = page?.type;
    if (!pageValidators[type]) {
      errors.push(`${where}.type "${type}" is not a known template — allowed: ${PAGE_TYPES.join(', ')}`);
      return;
    }
    const validate = pageValidators[type];
    if (!validate(page)) {
      errors.push(...formatErrors(where, validate.errors));
    }
    if (page.id) {
      if (seenIds.has(page.id)) errors.push(`${where}.id "${page.id}" duplicates an earlier page id`);
      seenIds.add(page.id);
    }
  });

  return { valid: errors.length === 0, errors, answersToConfirm: collectAnswerKeys(course) };
}

/**
 * The no-fabrication gate (scrybe factsToConfirm, re-aimed at correctness):
 * list every answer-key fact so a HUMAN confirms them — the authoring skill
 * may draft distractors/prose but never silently invents these.
 */
function collectAnswerKeys(course) {
  const out = [];
  const meta = course?.meta || {};
  if (meta.passingScore !== undefined) out.push(`meta.passingScore = ${meta.passingScore}`);
  if (meta.masteryScore !== undefined) out.push(`meta.masteryScore = ${meta.masteryScore}`);

  for (const page of (Array.isArray(course?.pages) ? course.pages : [])) {
    const tag = `${page?.id} (${page?.type})`;
    if (page?.weight !== undefined) out.push(`${tag}: weight = ${page.weight}`);
    if (page?.type === 'choice' && Array.isArray(page.choices)) {
      const correct = page.choices.filter(c => c?.correct).map(c => `${c.id} "${c.text}"`);
      out.push(`${tag}: correct = ${correct.join(', ') || '(none marked!)'}`);
    }
    if (page?.type === 'match' && Array.isArray(page.pairs)) {
      page.pairs.forEach(p => out.push(`${tag}: ${p.sourceText} → ${p.targetText}`));
    }
    if (page?.type === 'wordpuzzle' && Array.isArray(page.blanks)) {
      page.blanks.forEach(b => out.push(`${tag}: {{${b.id}}} = ${(b.answers || []).join(' | ')}`));
    }
  }
  return out;
}

// CLI: node tools/validate-course.js [path]
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = process.argv[2] || path.join(ROOT_DIR, 'data', 'scobot.json');
  const { valid, errors, answersToConfirm } = validateCourse(target);
  if (!valid) {
    console.error(`\n❌ ${path.relative(ROOT_DIR, target)} is INVALID:\n`);
    errors.forEach(e => console.error(` - ${e}`));
    process.exit(1);
  }
  console.log(`✅ ${path.relative(ROOT_DIR, target)} is valid (${PAGE_TYPES.length} page types known).`);
  if (answersToConfirm.length) {
    console.log('\n🔑 Answers to confirm (never fabricated — a human must verify these):');
    answersToConfirm.forEach(a => console.log(` - ${a}`));
  }
}
