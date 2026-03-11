import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { minify } from 'terser';
import { minify as cssoMinify } from 'csso';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

let stats = {
  originalSize: 0,
  minifiedSize: 0,
  filesProcessed: 0
};

const BUILD_ID = Date.now().toString(36);
const TEXT_SCAN_EXTENSIONS = new Set(['.html', '.js', '.css', '.json', '.txt', '.svg', '.xml', '.webmanifest']);
const TEXT_REWRITE_EXTENSIONS = new Set(['.html', '.json', '.txt', '.svg', '.xml', '.webmanifest']);

function rewriteDistPathPrefix(value) {
  return String(value || '').replace(/\/src\//g, '/');
}

function normalizeDistIndexHtml() {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) return;

  let html = fs.readFileSync(indexPath, 'utf8');

  html = html.replace(/(<script\s+type="importmap">\s*)([\s\S]*?)(\s*<\/script>)/i, (match, open, jsonText, close) => {
    try {
      const parsed = JSON.parse(jsonText);
      const imports = parsed?.imports || {};
      for (const [key, specifier] of Object.entries(imports)) {
        imports[key] = rewriteDistPathPrefix(specifier);
      }
      return `${open}${JSON.stringify(parsed, null, 2)}${close}`;
    } catch {
      return match.replace(/"\/src\//g, '"/');
    }
  });

  html = html.replace(/((?:href|src)="?)\/?src\//gi, '$1/');

  fs.writeFileSync(indexPath, html, 'utf8');
}

function withVersion(specifier) {
  const value = String(specifier || '').trim();
  if (!value) return value;

  // Do not touch bare specifiers/import-map aliases (e.g. @core/router.js, @state)
  // Only version relative or absolute paths that map to real files.
  const isPathLike = value.startsWith('./') || value.startsWith('../') || value.startsWith('/');
  if (!isPathLike) return value;

  // Avoid duplicating cache-buster when query already exists.
  if (value.includes('?')) return value;

  return `${value}?v=${BUILD_ID}`;
}

async function main() {
  console.log('\x1b[1m\x1b[36m⚡ Axiom Build System ⚡\x1b[0m\n');

  // 1. Clean Dist
  if (fs.existsSync(DIST_DIR)) {
    console.log('Cleaning dist...');
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR);

  // 2. Copy Index & Manifest
  copyFile('index.html');
  copyFile('manifest.json');
  copyFile('sw.js');
  copyDir('assets');
  copyDir('public');
  copyDir('data');
  copyDir('lib');
  normalizeDistIndexHtml();

  // 3. Process Src
  console.log('Processing src...');
  await processDir(SRC_DIR, DIST_DIR);
  assertNoSrcReferencesInDist();
  assertNoAliasConflicts();

  printNutritionFacts();
}

function collectFilesRecursive(dirPath, result = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectFilesRecursive(fullPath, result);
      continue;
    }
    result.push(fullPath);
  }
  return result;
}

function buildLineNumberIndex(text) {
  const index = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') index.push(i + 1);
  }
  return index;
}

function findLineNumber(lineStartIndex, position) {
  let low = 0;
  let high = lineStartIndex.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStartIndex[mid] <= position) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return Math.max(1, high + 1);
}

function assertNoSrcReferencesInDist() {
  const violations = [];
  const files = collectFilesRecursive(DIST_DIR);

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    if (!TEXT_SCAN_EXTENSIONS.has(ext)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('/src/')) continue;

    const lineStartIndex = buildLineNumberIndex(content);
    const pattern = /\/src\//g;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const line = findLineNumber(lineStartIndex, match.index);
      violations.push({
        file: path.relative(ROOT_DIR, filePath),
        line
      });
      if (violations.length >= 25) break;
    }

    if (violations.length >= 25) break;
  }

  if (violations.length === 0) return;

  console.error('\n❌ Build guard failed: unresolved /src/ references found in dist output.');
  violations.forEach((v) => {
    console.error(` - ${v.file}:${v.line}`);
  });
  if (violations.length >= 25) {
    console.error(' - (truncated to first 25 violations)');
  }
  throw new Error('Hard-fail guard blocked build. Resolve /src/ paths before deploy.');
}

/**
 * Build guard: detect imports that use a namespace prefix when an explicit
 * alias exists for the same file.  Namespace-resolved paths skip cache-busting,
 * creating a second module instance and a split-singleton bug.
 *
 * Example: "@state" → "/src/core/state.js"  (explicit, gets ?v=)
 *          "@core/state.js" via "@core/" namespace  (no ?v=)
 *          → two module instances in the browser.
 */
function assertNoAliasConflicts() {
  const indexPath = path.join(ROOT_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) return;

  const html = fs.readFileSync(indexPath, 'utf8');
  const mapMatch = html.match(/<script\s+type="importmap">\s*([\s\S]*?)\s*<\/script>/i);
  if (!mapMatch) return;

  let imports;
  try {
    imports = JSON.parse(mapMatch[1]).imports || {};
  } catch { return; }

  // Collect namespace prefixes  (e.g. "@core/" → "/src/core/")
  const namespaces = {};
  for (const [key, value] of Object.entries(imports)) {
    if (key.endsWith('/')) namespaces[key] = value;
  }

  // For each explicit (non-namespace) alias, check if a namespace would also
  // resolve to the same file.  Build a map: "bad specifier" → "correct alias".
  const conflicts = {}; // e.g. { "@core/state.js": "@state" }
  for (const [alias, target] of Object.entries(imports)) {
    if (alias.endsWith('/')) continue; // skip namespaces
    for (const [nsKey, nsBase] of Object.entries(namespaces)) {
      if (!target.startsWith(nsBase)) continue;
      const remainder = target.slice(nsBase.length);
      const nsSpecifier = nsKey + remainder; // e.g. "@core/state.js"
      if (nsSpecifier !== alias) {
        conflicts[nsSpecifier] = alias;
      }
    }
  }

  if (Object.keys(conflicts).length === 0) return;

  // Scan source files for bad specifiers
  const violations = [];
  const srcFiles = collectFilesRecursive(SRC_DIR);
  const importPattern = /from\s+['"]([^'"]+)['"]/g;

  for (const filePath of srcFiles) {
    if (path.extname(filePath).toLowerCase() !== '.js') continue;
    const content = fs.readFileSync(filePath, 'utf8');
    let match;
    importPattern.lastIndex = 0;
    while ((match = importPattern.exec(content)) !== null) {
      const specifier = match[1];
      if (conflicts[specifier]) {
        const lineStartIndex = buildLineNumberIndex(content);
        const line = findLineNumber(lineStartIndex, match.index);
        violations.push({
          file: path.relative(ROOT_DIR, filePath),
          line,
          bad: specifier,
          fix: conflicts[specifier]
        });
      }
      if (violations.length >= 25) break;
    }
    if (violations.length >= 25) break;
  }

  if (violations.length === 0) return;

  console.error('\n❌ Build guard failed: import alias conflicts detected.');
  console.error('   These imports resolve via namespace (no cache-bust) instead of their explicit alias.');
  console.error('   This creates duplicate module instances and split-singleton bugs in production.\n');
  violations.forEach((v) => {
    console.error(` - ${v.file}:${v.line}  "${v.bad}" → use "${v.fix}"`);
  });
  throw new Error('Hard-fail guard blocked build. Fix aliased imports before deploy.');
}

function copyFile(name) {
  const srcPath = path.join(ROOT_DIR, name);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, path.join(DIST_DIR, name));
    console.log(`Copied ${name}`);
  }
}

function copyDir(name) {
  const srcPath = path.join(ROOT_DIR, name);
  const destPath = path.join(DIST_DIR, name);
  if (fs.existsSync(srcPath)) {
    fs.cpSync(srcPath, destPath, { recursive: true });
    console.log(`Copied ${name}/`);
  }
}

async function processDir(currentSrc, currentDist) {
  if (!fs.existsSync(currentDist)) {
    fs.mkdirSync(currentDist);
  }

  const entries = fs.readdirSync(currentSrc, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(currentSrc, entry.name);
    const distPath = path.join(currentDist, entry.name);

    if (entry.isDirectory()) {
      await processDir(srcPath, distPath);
    } else {
      await processFile(srcPath, distPath);
    }
  }
}

async function processFile(srcPath, distPath) {
  const ext = path.extname(srcPath).toLowerCase();

  try {
    let original = 0;
    let minified = 0;

    if (ext === '.js') {
      let code = fs.readFileSync(srcPath, 'utf8');
      original = Buffer.byteLength(code, 'utf8');

      // BUILD FIX: Rewrite absolute /src/ paths to root paths for distribution
      code = rewriteDistPathPrefix(code);

      // CACHE BUSTING: Append ?v=BUILD_ID only to path-like ES module imports
      // (relative/absolute). Do NOT mutate import-map aliases like @core/*.
      // 1) Static imports: import {x} from "path.js" / import "path.js"
      code = code.replace(/from\s+(['"])([^'"]+\.js)\1/g, (match, quote, specifier) => {
        return `from ${quote}${withVersion(specifier)}${quote}`;
      });

      code = code.replace(/import\s+(['"])([^'"]+\.js)\1/g, (match, quote, specifier) => {
        return `import ${quote}${withVersion(specifier)}${quote}`;
      });

      // 2) Dynamic imports: import("path.js") / import(`path.js`)
      code = code.replace(/import\s*\(\s*(['"`])([^'"`]+\.js)\1\s*\)/g, (match, quote, specifier) => {
        return `import(${quote}${withVersion(specifier)}${quote})`;
      });

      const result = await minify(code, { module: true });
      if (result.code) {
        fs.writeFileSync(distPath, result.code, 'utf8');
        minified = Buffer.byteLength(result.code, 'utf8');
      } else {
        throw new Error(`Terser failed for ${srcPath}`);
      }
    } else if (ext === '.css') {
      let code = fs.readFileSync(srcPath, 'utf8');
      original = Buffer.byteLength(code, 'utf8');

      // BUILD FIX: Rewrite absolute /src/ paths to root paths for distribution
      code = rewriteDistPathPrefix(code);

      const result = cssoMinify(code);
      fs.writeFileSync(distPath, result.css, 'utf8');
      minified = Buffer.byteLength(result.css, 'utf8');
    } else {
      // Rewrite text-based non-code assets to keep dist path-safe for new content.
      if (TEXT_REWRITE_EXTENSIONS.has(ext)) {
        const content = fs.readFileSync(srcPath, 'utf8');
        const rewritten = rewriteDistPathPrefix(content);
        fs.writeFileSync(distPath, rewritten, 'utf8');
        original = Buffer.byteLength(content, 'utf8');
        minified = Buffer.byteLength(rewritten, 'utf8');
      } else {
        // Direct copy for binary/non-text assets.
        fs.copyFileSync(srcPath, distPath);
        const stat = fs.statSync(srcPath);
        original = stat.size;
        minified = stat.size;
      }
    }

    stats.originalSize += original;
    stats.minifiedSize += minified;
    stats.filesProcessed++;

  } catch (err) {
    console.error(`Error processing ${srcPath}:`, err.message);
    // Fallback copy
    fs.copyFileSync(srcPath, distPath);
  }
}

function printNutritionFacts() {
  const savings = stats.originalSize - stats.minifiedSize;
  const percent = ((savings / stats.originalSize) * 100).toFixed(1);

  const formatSize = (bytes) => (bytes / 1024).toFixed(2) + ' KB';

  console.log('\n\x1b[1m\x1b[47m\x1b[30m  Build Nutrition Facts  \x1b[0m');
  console.log('───────────────────────');
  console.log(`Files Processed:  ${stats.filesProcessed}`);
  console.log('───────────────────────');
  console.log(`Original Size:    ${formatSize(stats.originalSize)}`);
  console.log(`Minified Size:    \x1b[32m${formatSize(stats.minifiedSize)}\x1b[0m`);
  console.log('───────────────────────');
  console.log(`Total Savings:    ${percent}% (${formatSize(savings)})`);
  console.log('───────────────────────\n');
  console.log('\x1b[32m✅ Build Complete.\x1b[0m Dist is ready.');
}

main();
