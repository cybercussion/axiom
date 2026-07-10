import fs from 'fs';
import path from 'path';

const featureName = process.argv[2];
if (!featureName) {
  console.error('Err: Specify a feature name (e.g., node tools/create-feature.js dashboard)');
  process.exit(1);
}

const baseDir = `./src/features/${featureName}`;
const className = featureName.charAt(0).toUpperCase() + featureName.slice(1);
const stateKey = `${featureName}Data`;

// 1. The Blueprint Templates
const templates = {
  // NOTE: We use [featureName].js (not -ui.js) to match the Router's expectation
  [`${featureName}.js`]: `import { BaseComponent } from '@shared/base-component.js';
import { state } from '@state';

const STATE_KEY = '${stateKey}';

class ${className}UI extends BaseComponent {
  async setup() {
    // Robust path resolution for the CSS sibling
    const cssPath = new URL('./${featureName}.css', import.meta.url).href;
    await this.addExternalStyles(cssPath);

    // Optional: subscribe to feature data if you use state.query below
    this.subscribe(STATE_KEY, (val) => this.render(val));
  }

  async connectedCallback() {
    await super.connectedCallback();

    // If this feature uses remote data, trigger a fetch without blocking navigation.
    const existing = state.get(STATE_KEY);
    if (!existing) {
      state.query(STATE_KEY, () =>
        import('./${featureName}-api.js').then(m => m.fetch${className}Data())
      ).catch(err => {
        console.error('Failed to load ${featureName} data', err);
      });
    }
  }

  render(featureState = {}) {
    // You can tailor this to check featureState.status === 'loading' / 'error' etc.
    this.shadowRoot.innerHTML = \`
      <section class="${featureName}">
        <h1>${className} Feature</h1>
      </section>
    \`;
  }
}
customElements.define('${featureName}-ui', ${className}UI);`,

  [`${featureName}.css`]: `:host { display: block; padding: var(--space-m); }\n.${featureName} { color: var(--color-primary); }`,

  [`${featureName}-api.js`]: `import { gateway } from '@core/gateway.js';\n\nexport const fetch${className}Data = async () => {\n  // This helper is intentionally thin; the feature owns when/how data is fetched.\n  return await gateway.get('/${featureName}');\n};`
};

// 2. The Execution
if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

Object.entries(templates).forEach(([fileName, content]) => {
  fs.writeFileSync(path.join(baseDir, fileName), content);
  console.log(`Created: ${path.join(baseDir, fileName)}`);
});

console.log(`\nSuccess: Feature "${featureName}" is ready for the Router.`);
