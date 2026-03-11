import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const INDEX_PATH = path.join(ROOT_DIR, 'index.html');
const MANIFEST_PATH = path.join(ROOT_DIR, 'manifest.json');
const SW_PATH = path.join(ROOT_DIR, 'sw.js');
const APP_PATH = path.join(ROOT_DIR, 'src', 'app.js');

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`✅ ${message}`);
}

function ensureFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(`${label} is missing: ${path.relative(ROOT_DIR, filePath)}`);
    return false;
  }
  pass(`${label} exists`);
  return true;
}

function checkIndex(indexHtml) {
  const checks = [
    { re: /<link\s+rel=["']manifest["']\s+href=["']\/manifest\.json["'][^>]*>/i, msg: 'index has manifest link' },
    { re: /<meta\s+name=["']theme-color["']\s+content=["'][^"']+["'][^>]*>/i, msg: 'index has theme-color meta' }
  ];

  for (const check of checks) {
    if (!check.re.test(indexHtml)) fail(check.msg);
    else pass(check.msg);
  }
}

function checkManifest(rawManifest) {
  let parsed;
  try {
    parsed = JSON.parse(rawManifest);
  } catch {
    fail('manifest.json is not valid JSON');
    return;
  }

  const required = ['name', 'short_name', 'start_url', 'display', 'theme_color', 'background_color', 'icons'];
  for (const key of required) {
    if (parsed[key] == null || parsed[key] === '') fail(`manifest missing required key: ${key}`);
    else pass(`manifest has ${key}`);
  }

  if (!Array.isArray(parsed.icons) || parsed.icons.length === 0) {
    fail('manifest icons must be a non-empty array');
  } else {
    pass('manifest icons array is present');
  }
}

function checkServiceWorker(swCode, appCode) {
  if (/addEventListener\(['"]install['"]/.test(swCode)) pass('service worker has install handler');
  else fail('service worker missing install handler');

  if (/addEventListener\(['"]fetch['"]/.test(swCode)) pass('service worker has fetch handler');
  else fail('service worker missing fetch handler');

  if (/navigator\.serviceWorker\.register\(['"]\/sw\.js['"]\)/.test(appCode)) pass('app registers /sw.js');
  else fail('app does not register /sw.js');
}

function main() {
  console.log('🔎 Axiom PWA Check\n');

  const hasIndex = ensureFileExists(INDEX_PATH, 'index.html');
  const hasManifest = ensureFileExists(MANIFEST_PATH, 'manifest.json');
  const hasSw = ensureFileExists(SW_PATH, 'sw.js');
  const hasApp = ensureFileExists(APP_PATH, 'src/app.js');

  if (!hasIndex || !hasManifest || !hasSw || !hasApp) {
    process.exit(process.exitCode || 1);
  }

  const indexHtml = fs.readFileSync(INDEX_PATH, 'utf8');
  const rawManifest = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const swCode = fs.readFileSync(SW_PATH, 'utf8');
  const appCode = fs.readFileSync(APP_PATH, 'utf8');

  checkIndex(indexHtml);
  checkManifest(rawManifest);
  checkServiceWorker(swCode, appCode);

  if (process.exitCode && process.exitCode !== 0) {
    console.error('\nPWA check failed.');
    process.exit(process.exitCode);
  }

  console.log('\n🎉 PWA check passed.');
}

main();
