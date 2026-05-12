import webConfig from './packages/web/eslint.config.js';
import desktopConfig from './packages/desktop/eslint.config.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/target/**',
      '**/*.d.ts',
      '**/vite.config.ts',
      'src/**',
      'packages/shared/**'
    ],
  },
  // Apply web config ONLY to web package files
  ...webConfig.map(config => ({
    ...config,
    files: config.files || ['packages/web/src/**/*.{ts,tsx}'],
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        ...(config.languageOptions?.parserOptions || {}),
        tsconfigRootDir: path.join(__dirname, 'packages/web'),
      }
    }
  })),
  // Apply desktop config ONLY to desktop package files
  ...desktopConfig.map(config => ({
    ...config,
    files: config.files || ['packages/desktop/src/**/*.{ts,tsx}'],
  })),
  {
    files: ['packages/web/src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'prefer-const': 'off',
      'no-constant-condition': 'off'
    }
  },
];
