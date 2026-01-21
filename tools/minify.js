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

async function main() {
  console.log('\x1b[1m\x1b[36m⚡ Axiom Build System ⚡\x1b[0m\n');

  // 1. Clean Dist
  if (fs.existsSync(DIST_DIR)) {
    console.log('Cleaning dist...');
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR);

  // 2. Copy Index & Manifest (with import map transformation)
  copyAndTransformIndex('index.html');
  copyFile('manifest.json');
  copyFile('favicon.png');
  copyDir('assets'); // Assuming assets exist, or fail silently

  // 3. Copy SCOBot library from node_modules
  copySCOBot();

  // 4. Copy data directory (course content)
  copyDir('data');

  // 5. Copy public directory (media assets)
  copyDir('public');

  // 6. Process Src
  console.log('Processing src...');
  await processDir(SRC_DIR, DIST_DIR);

  printNutritionFacts();
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

/**
 * Copy SCOBot library from node_modules to dist/lib/
 * Updates import map to point to the new location
 */
function copySCOBot() {
  const scobotSrc = path.join(ROOT_DIR, 'node_modules/@cybercussion/scobot/dist/scobot.js');
  const scobotDest = path.join(DIST_DIR, 'lib/scobot.js');

  if (fs.existsSync(scobotSrc)) {
    // Create lib directory
    const libDir = path.join(DIST_DIR, 'lib');
    if (!fs.existsSync(libDir)) {
      fs.mkdirSync(libDir, { recursive: true });
    }
    fs.copyFileSync(scobotSrc, scobotDest);
    console.log('Copied SCOBot library to lib/scobot.js');
  } else {
    console.warn('⚠️  SCOBot library not found in node_modules');
  }
}

/**
 * Copy and transform index.html for dist
 * - Updates import map paths for production
 * - Adjusts base href for SCORM package compatibility
 */
function copyAndTransformIndex(name) {
  const srcPath = path.join(ROOT_DIR, name);
  if (!fs.existsSync(srcPath)) return;

  let content = fs.readFileSync(srcPath, 'utf-8');

  // Update import map for dist structure
  // Change node_modules path to lib/ for SCOBot
  content = content.replace(
    '"@scobot": "./node_modules/@cybercussion/scobot/dist/scobot.js"',
    '"@scobot": "./lib/scobot.js"'
  );

  // Update base href for relative paths (SCORM compatibility)
  // SCORM packages run from various locations, so use relative base
  content = content.replace('<base href="/">', '<base href="./">');

  // Update import map paths: ./src/ becomes ./
  // Since minify.js puts src/* directly in dist/, not dist/src/
  content = content.replace('"@state": "./src/core/state.js"', '"@state": "./core/state.js"');
  content = content.replace('"@core/": "./src/core/"', '"@core/": "./core/"');
  content = content.replace('"@shared/": "./src/shared/"', '"@shared/": "./shared/"');
  content = content.replace('"@features/": "./src/features/"', '"@features/": "./features/"');

  // Update modulepreload and script paths
  content = content.replace(/href="src\//g, 'href="');
  content = content.replace(/src="src\//g, 'src="');

  fs.writeFileSync(path.join(DIST_DIR, name), content);
  console.log(`Copied and transformed ${name}`);
}

/**
 * Transform JS source code paths for dist
 * Replaces src/ references with root-relative paths since
 * dist/ contains src/* contents at root level
 */
function transformJsPaths(code) {
  // fetch("src/...) → fetch("...  (preserving the quote type)
  code = code.replace(/fetch\("src\//g, 'fetch("');
  code = code.replace(/fetch\('src\//g, "fetch('");
  code = code.replace(/fetch\(`src\//g, 'fetch(`');
  
  // import("src/...) → import("...  (dynamic imports, preserving quote type)
  code = code.replace(/import\("src\//g, 'import("');
  code = code.replace(/import\('src\//g, "import('");
  code = code.replace(/import\(`src\//g, 'import(`');
  
  // new URL("./data/...) paths should work as-is since data/ is copied to dist/data/
  
  return code;
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
  const ext = path.extname(srcPath);

  try {
    let original = 0;
    let minified = 0;

    if (ext === '.js') {
      let code = fs.readFileSync(srcPath, 'utf8');
      original = Buffer.byteLength(code, 'utf8');
      
      // Transform src/ paths to work in dist (where src/ contents are at root)
      code = transformJsPaths(code);
      
      const result = await minify(code, { module: true });
      if (result.code) {
        fs.writeFileSync(distPath, result.code, 'utf8');
        minified = Buffer.byteLength(result.code, 'utf8');
      } else {
        throw new Error(`Terser failed for ${srcPath}`);
      }
    } else if (ext === '.css') {
      const code = fs.readFileSync(srcPath, 'utf8');
      original = Buffer.byteLength(code, 'utf8');
      const result = cssoMinify(code);
      fs.writeFileSync(distPath, result.css, 'utf8');
      minified = Buffer.byteLength(result.css, 'utf8');
    } else {
      // Direct copy (assume no compression for now, or use file size)
      fs.copyFileSync(srcPath, distPath);
      // For copied files, size is same
      const stat = fs.statSync(srcPath);
      original = stat.size;
      minified = stat.size;
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
