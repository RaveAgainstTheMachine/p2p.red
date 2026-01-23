import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import * as tseslint from 'typescript-eslint';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const baseDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)));

export default tseslint.config(
  {
    ignores: [path.join(baseDir, 'dist/**')],
  },
  {
    files: [path.join(baseDir, 'src/**/*.{ts,tsx}')],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        project: [path.join(baseDir, 'tsconfig.json')],
        tsconfigRootDir: baseDir,
      },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks/set-state-in-effect': 'off',
      '@typescript-eslint/no-explicit-any': 'off'
    },
  }
);
