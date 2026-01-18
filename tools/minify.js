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

  // 2. Copy Index & Manifest
  copyFile('index.html');
  copyFile('manifest.json');
  copyDir('assets'); // Assuming assets exist, or fail silently

  // 3. Process Src
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
      const code = fs.readFileSync(srcPath, 'utf8');
      original = Buffer.byteLength(code, 'utf8');
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
