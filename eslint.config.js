import webConfig from './packages/web/eslint.config.js';
import desktopConfig from './packages/desktop/eslint.config.js';

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
  ...webConfig,
  ...desktopConfig,
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
