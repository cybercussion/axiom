// Browser tests (npm run e2e). The app runs under the PRODUCTION
// Content-Security-Policy (tools/serve.js --csp), so every test is also a CSP
// compatibility test.
import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  // Out of the tree: traces and screenshots are regenerable bytes.
  outputDir: path.join(os.tmpdir(), 'axiom-e2e-results'),
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node tools/serve.js --port ${PORT} --csp`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
