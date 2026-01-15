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
];
