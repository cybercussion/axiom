import fs from 'fs';
import path from 'path';

const featureName = process.argv[2];
if (!featureName) {
  console.error('Err: Specify a feature name (e.g., node tools/create-feature.js dashboard)');
  process.exit(1);
}

const baseDir = `./src/features/${featureName}`;

// 1. The Blueprint Templates
const templates = {
  // NOTE: We use [featureName].js (not -ui.js) to match the Router's expectation
  [`${featureName}.js`]: `import { BaseComponent } from '@shared/base-component.js';
import { fetch${featureName.charAt(0).toUpperCase() + featureName.slice(1)}Data } from './${featureName}-api.js';

class ${featureName.charAt(0).toUpperCase() + featureName.slice(1)}UI extends BaseComponent {
  async setup() {
    // Robust path resolution for the CSS sibling
    const cssPath = new URL('./${featureName}.css', import.meta.url).href;
    await this.addExternalStyles(cssPath);
  }

  render() {
    this.shadowRoot.innerHTML = \`<section class="${featureName}"><h1>${featureName} Feature</h1></section>\`;
  }
}
customElements.define('${featureName}-ui', ${featureName.charAt(0).toUpperCase() + featureName.slice(1)}UI);`,

  [`${featureName}.css`]: `:host { display: block; padding: var(--space-m); }\n.${featureName} { color: var(--color-primary); }`,

  [`${featureName}-api.js`]: `import { gateway } from '@core/gateway.js';\n\nexport const fetch${featureName.charAt(0).toUpperCase() + featureName.slice(1)}Data = async () => {\n  return await gateway.get('/${featureName}');\n};`
};

// 2. The Execution
if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

Object.entries(templates).forEach(([fileName, content]) => {
  fs.writeFileSync(path.join(baseDir, fileName), content);
  console.log(`Created: ${path.join(baseDir, fileName)}`);
});

console.log(`\nSuccess: Feature "${featureName}" is ready for the Router.`);
