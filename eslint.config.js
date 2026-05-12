import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import js from '@eslint/js';
import globals from 'globals';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/target/**',
      '**/*.d.ts',
      '**/vite.config.ts',
      '**/vitest.config.ts',
      'src/**',
      'packages/shared/**',
      'packages/desktop/**',
      'automation/**',
      'scripts/**',
      'public/**',
      'tests/**',
      '**/*.config.ts',
      '**/*.config.js',
      '**/eslint.config.js',
      '**/sw.js',
      '**/*.js'
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node
      },
      parser: tseslint.parser,
      parserOptions: {
        project: ['./packages/web/tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-wrapper-object-types': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
      'prefer-const': 'off',
      'no-constant-condition': 'off',
      'no-case-declarations': 'off',
      'no-empty': 'off'
    }
  }
];
