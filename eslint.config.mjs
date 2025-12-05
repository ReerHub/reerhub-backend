import globals from 'globals';
import pluginJs from '@eslint/js';

/** @type {import('eslint').Linter.Config[]} */
export default [
  // 1. IGNORES (Replaces .eslintignore)
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', '.next/**'],
  },

  // 2. CONFIGURATION
  {
    languageOptions: {
      // Define environment globals (Node.js backend)
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    // Custom Rules
    rules: {
      'no-console': 'off', // Backend needs console logs
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }], // Ignore variables starting with _
      'no-undef': 'error',
    },
  },

  // 3. BASE RECOMMENDED RULES
  pluginJs.configs.recommended,
];
