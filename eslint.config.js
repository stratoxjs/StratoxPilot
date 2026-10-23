import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    languageOptions: {
      globals: globals.browser,
      ecmaVersion: 2022,
      sourceType: "module"
    }
  },
  pluginJs.configs.recommended,
  // TypeScript files only, so the JavaScript files keep the rules above (D-054)
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ['**/*.ts'] })),
  // Unused parameters (a field method's helper) and skipped array entries ([key, value]) are fine (D-059)
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { args: 'none', destructuredArrayIgnorePattern: '.' }],
    },
  },
  {
    ignores: [
      'spec/', 
      '*.spec.js', 
      'coverage/',
      'dist/',
    ]
  },
  {
    files: ["templates/**/*.js"],
    rules: {
      'no-unused-vars': 'off',
      'class-methods-use-this': 'off',
      'no-console': 'off',
      'no-plusplus': 'off',
    }
  }
];