import webConfig from './packages/web/eslint.config.js';
import desktopConfig from './packages/desktop/eslint.config.js';

import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/target/**',
      '**/*.d.ts',
      '**/vite.config.ts',
      'src/**',
      'packages/shared/**',
    ],
  },
  js.configs.recommended,
  ...webConfig,
  ...desktopConfig,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'prefer-const': 'off',
      'no-constant-condition': 'off'
    }
  },
);
