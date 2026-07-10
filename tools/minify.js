import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { minify } from 'terser';
import { minify as cssoMinify } from 'csso';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

// ── BUILD PROFILE ───────────────────────────────────────────────────────────
// 'web'   — website lane (main): absolute paths, aliases RESOLVED away by the
//           build, ?v= on every module URL. See docs/patterns/stale-deploy-prevention.md.
// 'scorm' — SCORM-package lane (this branch): a SCO is served from an arbitrary
//           LMS content path, so dist uses <base href="./"> and RELATIVE paths,
//           and the import map stays LIVE at runtime (aliases are NOT resolved —
//           a relative specifier inside a nested module would resolve against the
//           module URL, not the document, so absolute-path resolution can't work
//           here). Cache-busting matters less (most LMSes serve each upload from
//           a fresh content root) but path-like imports and import-map values
//           still get ?v= for reupload safety.
const BUILD_PROFILE = 'scorm';

let stats = {
  originalSize: 0,
  minifiedSize: 0,
  filesProcessed: 0
};

const BUILD_ID = Date.now().toString(36);
const TEXT_SCAN_EXTENSIONS = new Set(['.html', '.js', '.css', '.json', '.txt', '.svg', '.xml', '.webmanifest']);
const TEXT_REWRITE_EXTENSIONS = new Set(['.html', '.json', '.txt', '.svg', '.xml', '.webmanifest']);

// Import-map namespace aliases → their absolute dist target ({ "@core/": "/core/", ... }).
// In the 'web' profile the build resolves aliases to absolute versioned paths (query-stamped
// bare aliases broke prod once — prefix maps with relative address values don't resolve a
// specifier that already carries a ?query). In the 'scorm' profile these maps are read (the
// alias-conflict guard needs them) but NOT used for stamping — the import map stays live.
const NAMESPACE_MAP = readNamespaceMap(path.join(ROOT_DIR, 'index.html'));
const EXACT_ALIAS_MAP = readExactAliasMap(path.join(ROOT_DIR, 'index.html'));

// What stampImports/stampRoutePaths actually resolve, per profile.
const STAMP_NAMESPACE_MAP = BUILD_PROFILE === 'web' ? NAMESPACE_MAP : {};
const STAMP_EXACT_MAP = BUILD_PROFILE === 'web' ? EXACT_ALIAS_MAP : {};

function rewriteDistPathPrefix(value) {
  // "/src/x" → "/x" and "./src/x" → "./x" — dist serves src/ contents at root.
  return String(value || '').replace(/\/src\//g, '/');
}

// SCORM profile: bare relative "src/…" references (no leading slash) in fetch()
// and dynamic import() also need the src/ segment dropped.
function transformBareSrcPaths(code) {
  return code
    .replace(/fetch\((['"`])src\//g, 'fetch($1')
    .replace(/import\(\s*(['"`])src\//g, 'import($1');
}

function normalizeDistIndexHtml() {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) return;

  let html = fs.readFileSync(indexPath, 'utf8');

  if (BUILD_PROFILE === 'scorm') {
    // SCORM packages run from arbitrary LMS locations — everything relative.
    html = html.replace('<base href="/">', '<base href="./">');
    // SCOBot ships from node_modules in dev; the build copies it to lib/.
    html = html.replace(
      '"@scobot": "./node_modules/@cybercussion/scobot/dist/scobot.js"',
      '"@scobot": "./lib/scobot.js"'
    );
  }

  html = html.replace(/(<script\s+type="importmap">\s*)([\s\S]*?)(\s*<\/script>)/i, (match, open, jsonText, close) => {
    try {
      const parsed = JSON.parse(jsonText);
      const imports = parsed?.imports || {};
      for (const [key, specifier] of Object.entries(imports)) {
        let v = rewriteDistPathPrefix(specifier);
        // Cache-bust exact-file APP aliases (e.g. "@state"): the query rides in the
        // VALUE, which the import-map spec allows — this is how the live map stays
        // fresh in the scorm profile. Skip vendor (/lib/) + prefix entries —
        // trailing-slash values MUST keep their bare trailing slash per the spec.
        if (/\.js$/.test(v) && !v.includes('/lib/')) v += `?v=${BUILD_ID}`;
        imports[key] = v;
      }
      return `${open}${JSON.stringify(parsed, null, 2)}${close}`;
    } catch {
      return match.replace(/"\/src\//g, '"/');
    }
  });

  // Drop the src/ path segment from href/src attributes. Web profile keeps
  // absolute form ("/x"); scorm keeps document-relative form ("x").
  html = html.replace(/((?:href|src)="?)\.?\/?src\//gi, BUILD_PROFILE === 'web' ? '$1/' : '$1');

  // Cache-bust the ENTRY module scripts. stampImports only versions ES-module
  // *import specifiers*, not these tags — without this an entry is served stale
  // from a long cache after a deploy → an old module graph.
  html = html.replace(/(<script\s+type="module"\s+src=")(?!https?:)([^"?]+\.js)(")/gi, `$1$2?v=${BUILD_ID}$3`);

  // Cache-bust stylesheets the same way.
  html = html.replace(/(<link\s+rel="stylesheet"\s+href=")(?!https?:)([^"?]+)(")/gi, `$1$2?v=${BUILD_ID}$3`);

  fs.writeFileSync(indexPath, html, 'utf8');
}

// Read the trailing-slash namespace aliases from the source import map and map each to its
// absolute dist path (source "./src/core/" or "/src/core/" → "/core/").
export function readNamespaceMap(indexHtmlPath) {
  if (!fs.existsSync(indexHtmlPath)) return {};
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  const mapMatch = html.match(/<script\s+type="importmap">\s*([\s\S]*?)\s*<\/script>/i);
  if (!mapMatch) return {};
  try {
    const imports = JSON.parse(mapMatch[1]).imports || {};
    const map = {};
    for (const [key, value] of Object.entries(imports)) {
      if (key.endsWith('/') && !key.startsWith('.') && !key.startsWith('/')) {
        map[key] = rewriteDistPathPrefix(String(value)).replace(/^\.?\//, '/');
      }
    }
    return map;
  } catch {
    return {};
  }
}

// Read the EXACT (non-slash) import-map aliases like "@state" and map each to its absolute
// dist path. Any ?query in the source value is dropped; the build re-applies a fresh ?v=.
export function readExactAliasMap(indexHtmlPath) {
  if (!fs.existsSync(indexHtmlPath)) return {};
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  const mapMatch = html.match(/<script\s+type="importmap">\s*([\s\S]*?)\s*<\/script>/i);
  if (!mapMatch) return {};
  try {
    const imports = JSON.parse(mapMatch[1]).imports || {};
    const map = {};
    for (const [key, value] of Object.entries(imports)) {
      if (!key.endsWith('/') && !key.startsWith('.') && !key.startsWith('/')) {
        map[key] = rewriteDistPathPrefix(String(value)).replace(/^\.?\//, '/').replace(/\?.*$/, '');
      }
    }
    return map;
  } catch {
    return {};
  }
}

export function withVersion(specifier, buildId = BUILD_ID, namespaceMap = STAMP_NAMESPACE_MAP, exactAliasMap = STAMP_EXACT_MAP) {
  const value = String(specifier || '').trim();
  if (!value) return value;

  // Avoid duplicating cache-buster when query already exists.
  if (value.includes('?')) return value;

  // Relative/absolute path imports: version in place — these resolve without the import map.
  if (value.startsWith('./') || value.startsWith('../') || value.startsWith('/')) {
    return `${value}?v=${buildId}`;
  }

  // Exact import-map alias (e.g. @state): resolve to its absolute dist path AND version it
  // (web profile only — scorm passes an empty map so aliases stay live).
  if (Object.prototype.hasOwnProperty.call(exactAliasMap, value)) {
    return `${exactAliasMap[value]}?v=${buildId}`;
  }

  // Import-map namespace alias (e.g. @core/router.js): resolve to its absolute dist path AND
  // version it (web profile only). We can't keep the alias and append ?v= — prefix maps with
  // relative address values won't resolve a query-bearing specifier.
  for (const [prefix, target] of Object.entries(namespaceMap)) {
    if (value.startsWith(prefix)) {
      return `${target}${value.slice(prefix.length)}?v=${buildId}`;
    }
  }

  // Bare specifier with no resolution requested (external package, or a live alias
  // in the scorm profile): leave as-is.
  return value;
}

// Cache-bust every ES module specifier in a chunk of JS — static `from "x.js"`, bare
// side-effect `import "x.js"`, and dynamic `import("x.js")`.
export function stampImports(code, buildId = BUILD_ID, namespaceMap = STAMP_NAMESPACE_MAP, exactAliasMap = STAMP_EXACT_MAP) {
  const v = (specifier) => withVersion(specifier, buildId, namespaceMap, exactAliasMap);
  let out = code
    .replace(/from\s+(['"])([^'"]+\.js)\1/g, (match, quote, specifier) => `from ${quote}${v(specifier)}${quote}`)
    .replace(/import\s+(['"])([^'"]+\.js)\1/g, (match, quote, specifier) => `import ${quote}${v(specifier)}${quote}`)
    .replace(/import\s*\(\s*(['"`])([^'"`]+\.js)\1\s*\)/g, (match, quote, specifier) => `import(${quote}${v(specifier)}${quote})`);

  // Exact aliases (e.g. @state) carry no ".js", so the regexes above never match them.
  for (const alias of Object.keys(exactAliasMap)) {
    const a = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const target = v(alias);
    out = out
      .replace(new RegExp(`from\\s+(['"])${a}\\1`, 'g'), (match, quote) => `from ${quote}${target}${quote}`)
      .replace(new RegExp(`import\\s*\\(\\s*(['"\`])${a}\\1\\s*\\)`, 'g'), (match, quote) => `import(${quote}${target}${quote})`);
  }
  return out;
}

// Cache-bust the lazy-route module paths stored as data: `path: "@features/x/x.js"` in ROUTES
// (src/app-routes.js). Targets the `path:` object key specifically, so it never touches
// import/from statements. In the scorm profile alias paths pass through untouched (live map).
export function stampRoutePaths(code, buildId = BUILD_ID, namespaceMap = STAMP_NAMESPACE_MAP) {
  return code.replace(
    /(\bpath\s*:\s*)(['"])([^'"]+\.js)\2/g,
    (match, prefix, quote, specifier) => `${prefix}${quote}${withVersion(specifier, buildId, namespaceMap)}${quote}`
  );
}

async function main() {
  console.log('\x1b[1m\x1b[36m⚡ Axiom Build System ⚡\x1b[0m\n');
  console.log(`Profile: ${BUILD_PROFILE}\n`);

  // 1. Clean Dist
  if (fs.existsSync(DIST_DIR)) {
    console.log('Cleaning dist...');
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR);

  // 2. Copy root files & static dirs
  copyFile('index.html');
  copyFile('manifest.json');
  copyFile('favicon.png');
  if (BUILD_PROFILE === 'web') {
    copyFile('sw.js');
    copyFile('_headers'); // Pages/Workers-Assets cache policy — inert inside a SCORM zip
  }
  copyDir('assets');
  copyDir('public');
  copyDir('data'); // course content (scobot.json)
  copyDir('lib');
  if (BUILD_PROFILE === 'scorm') copySCOBot();
  normalizeDistIndexHtml();

  // 3. Process Src
  console.log('Processing src...');
  await processDir(SRC_DIR, DIST_DIR);
  assertNoSrcReferencesInDist();
  assertNoAliasConflicts();
  assertSingleCacheBustId();

  printNutritionFacts();
}

/**
 * Copy the SCOBot library from node_modules to dist/lib/ — the import map's
 * "@scobot" entry is rewritten to ./lib/scobot.js by normalizeDistIndexHtml,
 * so the package never depends on node_modules.
 */
function copySCOBot() {
  const scobotSrc = path.join(ROOT_DIR, 'node_modules/@cybercussion/scobot/dist/scobot.js');
  const scobotDest = path.join(DIST_DIR, 'lib/scobot.js');

  if (fs.existsSync(scobotSrc)) {
    fs.mkdirSync(path.join(DIST_DIR, 'lib'), { recursive: true });
    fs.copyFileSync(scobotSrc, scobotDest);
    console.log('Copied SCOBot library to lib/scobot.js');
  } else {
    console.warn('⚠️  SCOBot library not found in node_modules');
  }
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
  const libPrefix = path.join(DIST_DIR, 'lib') + path.sep;

  for (const filePath of files) {
    // Vendor libraries (SCOBot, three.js etc.) legitimately contain "/src/" in doc URLs.
    if (filePath.startsWith(libPrefix)) continue;

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
 * alias exists for the same file.  In the web profile, namespace-resolved paths
 * skip cache-busting; in BOTH profiles the mismatch creates a second module
 * instance and a split-singleton bug.
 *
 * Example: "@state" → "./src/core/state.js"  (explicit)
 *          "@core/state.js" via "@core/" namespace
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

  const namespaces = {};
  for (const [key, value] of Object.entries(imports)) {
    if (key.endsWith('/')) namespaces[key] = value;
  }

  const conflicts = {}; // e.g. { "@core/state.js": "@state" }
  for (const [alias, target] of Object.entries(imports)) {
    if (alias.endsWith('/')) continue; // skip namespaces
    for (const [nsKey, nsBase] of Object.entries(namespaces)) {
      if (!target.startsWith(nsBase)) continue;
      const remainder = target.slice(nsBase.length);
      const nsSpecifier = nsKey + remainder;
      if (nsSpecifier !== alias) {
        conflicts[nsSpecifier] = alias;
      }
    }
  }

  if (Object.keys(conflicts).length === 0) return;

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
  console.error('   These imports resolve via namespace instead of their explicit alias.');
  console.error('   This creates duplicate module instances and split-singleton bugs in production.\n');
  violations.forEach((v) => {
    console.error(` - ${v.file}:${v.line}  "${v.bad}" → use "${v.fix}"`);
  });
  throw new Error('Hard-fail guard blocked build. Fix aliased imports before deploy.');
}

/**
 * Build guard: cache-busting has ONE owner — this file's BUILD_ID. If a second
 * stamping pass exists anywhere (a deploy script, a post-build step), module
 * preloads/imports can carry MISMATCHED ids: the preload is wasted and the module
 * downloads twice. Scoped to .js/.css URLs so intentional hand-bumped IMAGE
 * busters (e.g. tile.jpg?v=4) are exempt.
 */
function assertSingleCacheBustId() {
  const ids = new Map(); // id → first "file:line" seen
  const files = collectFilesRecursive(DIST_DIR);
  const libPrefix = path.join(DIST_DIR, 'lib') + path.sep;
  const pattern = /\.(?:js|css)\?v=([A-Za-z0-9.-]+)/g;

  for (const filePath of files) {
    if (filePath.startsWith(libPrefix)) continue;
    const ext = path.extname(filePath).toLowerCase();
    if (!TEXT_SCAN_EXTENSIONS.has(ext)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      if (!ids.has(match[1])) {
        const line = findLineNumber(buildLineNumberIndex(content), match.index);
        ids.set(match[1], `${path.relative(ROOT_DIR, filePath)}:${line}`);
      }
    }
  }

  if (ids.size <= 1) return;

  console.error('\n❌ Build guard failed: multiple cache-bust ids found in dist output.');
  console.error('   Cache-busting has ONE owner (minify.js BUILD_ID). A second ?v= pass causes');
  console.error('   preload/import id mismatches → wasted preloads and double downloads.\n');
  for (const [id, where] of ids) {
    console.error(` - ?v=${id}  (first seen ${where})`);
  }
  throw new Error('Hard-fail guard blocked build. Remove the second cache-bust pass.');
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

      // BUILD FIX: drop the src/ path segment (dist serves src/ contents at root)
      code = rewriteDistPathPrefix(code);
      if (BUILD_PROFILE === 'scorm') code = transformBareSrcPaths(code);

      // CACHE BUSTING: version path-like imports in place. Web profile also
      // resolves import-map aliases to absolute versioned paths; scorm profile
      // leaves aliases live (STAMP_* maps are empty).
      code = stampImports(code);
      code = stampRoutePaths(code);

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

// Run the build only when invoked directly (node tools/minify.js), not when imported
// by tests — importing must not trigger a full dist rebuild.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
