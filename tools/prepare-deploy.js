const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '../index.html');
const content = fs.readFileSync(target, 'utf8');

// Robust regex to find the base tag anywhere (handling indentation)
const updated = content.replace(/<base\s+href="[^"]*"\s*\/?>/i, '<base href="/axiom/">');

fs.writeFileSync(target, updated, 'utf8');
console.log('✅ Production base path injected: /axiom/');

// Validate
if (!updated.includes('<base href="/axiom/">')) {
  console.error('❌ Failed to inject base path!');
  process.exit(1);
}
