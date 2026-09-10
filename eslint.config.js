import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    // App source: browser ES modules (zero-build — what ships is what lints)
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      // Empty catch is a deliberate idiom here (VT AbortError swallows, probe guards)
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Underscore-prefixed params/vars mark intentional non-use (house convention)
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Build tooling: Node scripts (minify, motion-gate, create-feature, tests)
    files: ['tools/**/*.js'],
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Core tests: Node test runner driving BROWSER modules. The setup harness
    // installs the browser globals, so both sets are in scope here.
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Service worker: the seeded template and a project's opted-in root sw.js
    files: ['tools/templates/sw.js', 'sw.js'],
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'script',
      globals: { ...globals.serviceworker },
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '.rift/**'],
  },
];
