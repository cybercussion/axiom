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

async function main() {
  console.log('\n\x1b[1m\x1b[32m✨ Axiom SEO Injector ✨\x1b[0m\n');
  console.log('This tool will inject best-practice SEO meta tags into your index.html.');
  console.log('Existing tags in <head> will be preserved, but new ones will be appended.\n');

  try {
    if (!fs.existsSync(TARGET_FILE)) {
      throw new Error('index.html not found in project root.');
    }

    // Interactive Prompts
    const config = {
      title: await ask('Page Title (e.g. Project Axiom): ') || 'Project Axiom',
      description: await ask('Description (Short summary): ') || 'High-performance web architecture.',
      keywords: await ask('Keywords (comma separated): ') || 'web, performance, zero-build',
      author: await ask('Author Name: ') || 'Axiom Team',
      twitter: await ask('Twitter Handle (e.g. @markstatkus): ') || '@markstatkus',
      url: await ask('Base URL (e.g. https://axiom.com): ') || 'http://localhost:3000',
      image: await ask('Social Share Image URL (absolute): ') || 'https://via.placeholder.com/1200x630.png?text=Axiom'
    };

    // PWA Check
    const args = process.argv.slice(2);
    let makePwa = args.includes('--pwa') || args.includes('-pwa');

    if (!makePwa) {
      const pwaAns = await ask('Generate PWA manifest.json? (y/N): ');
      makePwa = pwaAns.toLowerCase().startsWith('y');
    }

    rl.close();

    console.log('\n\x1b[33mGenerating Meta Tags...\x1b[0m');

    const metaTags = generateMetaTags(config);
    const jsonLd = generateJsonLd(config);

    if (makePwa) {
      generateManifestFile(config);
    }

    const injectionBlock = `
    <!-- [Start] Axiom SEO Injection -->
    <title>${config.title}</title>
    <meta name="description" content="${config.description}">
    <meta name="keywords" content="${config.keywords}">
    <meta name="author" content="${config.author}">
    <meta name="theme-color" content="#09090b">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <link rel="manifest" href="/manifest.json">
    <link rel="canonical" href="${config.url}">

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${config.url}">
    <meta property="og:title" content="${config.title}">
    <meta property="og:description" content="${config.description}">
    <meta property="og:image" content="${config.image}">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${config.url}">
    <meta property="twitter:title" content="${config.title}">
    <meta property="twitter:description" content="${config.description}">
    <meta property="twitter:image" content="${config.image}">
    <meta name="twitter:creator" content="${config.twitter}">

    <!-- JSON-LD Structured Data -->
    <script type="application/ld+json">
    ${JSON.stringify(jsonLd)}
    </script>
    <!-- [End] Axiom SEO Injection -->
    `;

    injectIntoHtml(injectionBlock);

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
      }
    ]
  };

  const manifestPath = path.join(ROOT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log('\x1b[32m✅ Generated manifest.json\x1b[0m');
}

function generateMetaTags(c) {
  // Placeholder if we wanted to build individual strings, 
  // currently handled in the template literal above.
  return [];
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

function injectIntoHtml(block) {
  let content = fs.readFileSync(TARGET_FILE, 'utf8');

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

main();
