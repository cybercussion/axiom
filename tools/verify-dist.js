import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const TEXT_SCAN_EXTENSIONS = new Set(['.html', '.js', '.css', '.json', '.txt', '.svg', '.xml', '.webmanifest']);

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

function verifyDist() {
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error('dist directory not found. Run "npm run build" first.');
  }

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
      violations.push({
        file: path.relative(ROOT_DIR, filePath),
        line: findLineNumber(lineStartIndex, match.index)
      });
      if (violations.length >= 25) break;
    }

    if (violations.length >= 25) break;
  }

  if (violations.length > 0) {
    console.error('\n❌ dist verification failed: unresolved /src/ references found.');
    violations.forEach((v) => {
      console.error(` - ${v.file}:${v.line}`);
    });
    if (violations.length >= 25) {
      console.error(' - (truncated to first 25 violations)');
    }
    process.exit(1);
  }

  console.log('✅ dist verification passed: no /src/ references found.');
}

try {
  verifyDist();
} catch (error) {
  console.error(`\n❌ dist verification error: ${error.message}`);
  process.exit(1);
}
