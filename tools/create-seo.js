import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const TARGET_FILE = path.join(ROOT_DIR, 'index.html');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (query) => new Promise((resolve) => rl.question(`\x1b[36m? ${query} \x1b[0m`, resolve));

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const body = arg.slice(2);
    const [rawKey, ...rest] = body.split('=');
    const key = rawKey.trim();
    const value = rest.length > 0 ? rest.join('=').trim() : true;
    if (!key) continue;
    parsed[key] = value;
  }
  return parsed;
}

function hasFlag(options, key) {
  return options[key] === true || options[key] === 'true' || options[key] === '1';
}

function toAbsoluteUrl(input, fallback = 'https://example.com') {
  const value = (input || '').trim();
  if (!value) return fallback;
  try {
    return new URL(value).toString();
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function serializeJsonLd(value) {
  return JSON.stringify(value).replace(/<\//g, '<\\/');
}

async function main() {
  console.log('\n\x1b[1m\x1b[32m✨ Axiom SEO Injector ✨\x1b[0m\n');
  console.log('This tool will inject best-practice SEO meta tags into your index.html.');
  console.log('Existing tags in <head> will be preserved, but new ones will be appended.\n');

  try {
    if (!fs.existsSync(TARGET_FILE)) {
      throw new Error('index.html not found in project root.');
    }

    const args = process.argv.slice(2);
    const options = parseArgs(args);
    const nonInteractive = hasFlag(options, 'non-interactive') || hasFlag(options, 'yes');

    const readValue = async (key, question, fallback) => {
      if (typeof options[key] === 'string' && options[key].trim()) {
        return options[key].trim();
      }
      if (nonInteractive) return fallback;
      return (await ask(question)).trim() || fallback;
    };

    const config = {
      title: await readValue('title', 'Page Title (e.g. Project Axiom): ', 'Project Axiom'),
      description: await readValue('description', 'Description (Short summary): ', 'High-performance web architecture.'),
      keywords: await readValue('keywords', 'Keywords (comma separated): ', 'web, performance, zero-build'),
      author: await readValue('author', 'Author Name: ', 'Axiom Team'),
      twitter: normalizeTwitterHandle(await readValue('twitter', 'Twitter Handle (e.g. @markstatkus): ', '@markstatkus')),
      url: toAbsoluteUrl(await readValue('url', 'Base URL (e.g. https://axiom.com): ', 'https://example.com/'), 'https://example.com/'),
      image: toAbsoluteUrl(await readValue('image', 'Social Share Image URL (absolute): ', 'https://via.placeholder.com/1200x630.png?text=Axiom'), 'https://via.placeholder.com/1200x630.png?text=Axiom')
    };

    // PWA Check
    let makePwa = args.includes('--pwa') || args.includes('-pwa') || hasFlag(options, 'pwa');

    if (hasFlag(options, 'no-pwa')) {
      makePwa = false;
    }

    if (!makePwa && !nonInteractive) {
      const pwaAns = await ask('Generate PWA manifest.json? (y/N): ');
      makePwa = pwaAns.toLowerCase().startsWith('y');
    }

    rl.close();

    console.log('\n\x1b[33mGenerating Meta Tags...\x1b[0m');

    const jsonLd = generateJsonLd(config);

    if (makePwa) {
      generateManifestFile(config);
    }

    const pwaTags = makePwa
      ? `
    <meta name="theme-color" content="#09090b">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <link rel="manifest" href="/manifest.json">`
      : '';

    const injectionBlock = `
    <!-- [Start] Axiom SEO Injection -->
    <meta name="description" content="${escapeHtml(config.description)}">
    <meta name="keywords" content="${escapeHtml(config.keywords)}">
    <meta name="author" content="${escapeHtml(config.author)}">
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
    <meta name="referrer" content="strict-origin-when-cross-origin">
    <link rel="canonical" href="${escapeHtml(config.url)}">${pwaTags}

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:locale" content="en_US">
    <meta property="og:url" content="${escapeHtml(config.url)}">
    <meta property="og:site_name" content="${escapeHtml(config.title)}">
    <meta property="og:title" content="${escapeHtml(config.title)}">
    <meta property="og:description" content="${escapeHtml(config.description)}">
    <meta property="og:image" content="${escapeHtml(config.image)}">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${escapeHtml(config.url)}">
    <meta name="twitter:title" content="${escapeHtml(config.title)}">
    <meta name="twitter:description" content="${escapeHtml(config.description)}">
    <meta name="twitter:image" content="${escapeHtml(config.image)}">
    <meta name="twitter:creator" content="${escapeHtml(config.twitter)}">
    <meta name="twitter:site" content="${escapeHtml(config.twitter)}">

    <!-- JSON-LD Structured Data -->
    <script type="application/ld+json">
    ${serializeJsonLd(jsonLd)}
    </script>
    <!-- [End] Axiom SEO Injection -->
    `;

    injectIntoHtml(injectionBlock, config.title);

  } catch (err) {
    console.error('\n\x1b[31mError:\x1b[0m', err.message);
    rl.close();
    process.exit(1);
  }
}

function generateManifestFile(c) {
  const manifest = {
    "name": c.title,
    "short_name": c.title.split(' ')[0] || "App",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#09090b",
    "theme_color": "#09090b",
    "description": c.description,
    "icons": [
      {
        "src": "icon-192.png",
        "sizes": "192x192",
        "type": "image/png"
      },
      {
        "src": "icon-512.png",
        "sizes": "512x512",
        "type": "image/png"
      },
      {
        "src": "icon-maskable-512.png",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "maskable"
      }
    ]
  };

  const manifestPath = path.join(ROOT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log('\x1b[32m✅ Generated manifest.json\x1b[0m');
}

function normalizeTwitterHandle(input) {
  const value = (input || '').trim();
  if (!value) return '@markstatkus';
  if (value.startsWith('@')) return value;
  return `@${value}`;
}

function generateJsonLd(c) {
  return {
    "@context": "https://schema.org/",
    "@type": "WebSite",
    "name": c.title,
    "url": c.url,
    "author": {
      "@type": "Person",
      "name": c.author
    },
    "description": c.description
  };
}

function injectIntoHtml(block, title) {
  let content = fs.readFileSync(TARGET_FILE, 'utf8');
  content = upsertTitle(content, title);

  // Check if we already injected
  if (content.includes('<!-- [Start] Axiom SEO Injection -->')) {
    console.log('\x1b[33mExisting SEO block found. Replaced.\x1b[0m');
    const regex = /<!-- \[Start\] Axiom SEO Injection -->[\s\S]*?<!-- \[End\] Axiom SEO Injection -->/;
    content = content.replace(regex, block.trim());
  } else {
    // Creating Backup
    fs.copyFileSync(TARGET_FILE, `${TARGET_FILE}.bak`);
    console.log('\x1b[32mCreated backup: index.html.bak\x1b[0m');

    // Inject before </head>
    if (content.includes('</head>')) {
      content = content.replace('</head>', `${block.trim()}\n  </head>`);
      console.log('\x1b[32mInjected new SEO block.\x1b[0m');
    } else {
      throw new Error('Could not find </head> tag in index.html');
    }
  }

  fs.writeFileSync(TARGET_FILE, content, 'utf8');
  console.log('\n\x1b[32m✅ Successfully updated index.html\x1b[0m');
}

function upsertTitle(content, title) {
  const safeTitle = escapeHtml(title);
  const titleRegex = /<title[^>]*>[\s\S]*?<\/title>/i;

  if (titleRegex.test(content)) {
    return content.replace(titleRegex, `<title>${safeTitle}</title>`);
  }

  if (content.includes('</head>')) {
    return content.replace('</head>', `  <title>${safeTitle}</title>\n</head>`);
  }

  return content;
}

main();
