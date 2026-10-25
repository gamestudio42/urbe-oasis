import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Math functions whose results may differ between JavaScript engines. Banned in the
// simulation so that replays stay bit-identical across browsers and Node.
const nonDeterministicMath = ['random', 'sin', 'cos', 'tan', 'atan', 'atan2', 'exp', 'log', 'pow'];

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/dist-site/**',
      'site/**',
      '**/node_modules/**',
      'references/**',
      'reports/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: [
      'packages/simulation/src/**/*.ts',
      'packages/shared/src/**/*.ts',
      'packages/kernel/src/**/*.ts',
    ],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'The simulation must not depend on wall-clock time.' },
        { name: 'performance', message: 'Measure timings outside the simulation core.' },
        { name: 'window', message: 'The simulation must run headless.' },
        { name: 'document', message: 'The simulation must run headless.' },
      ],
      'no-restricted-properties': [
        'error',
        ...nonDeterministicMath.map((property) => ({
          object: 'Math',
          property,
          message: 'Use deterministic arithmetic or the seeded RNG instead.',
        })),
      ],
    },
  },
  {
    files: [
      'apps/web/src/**/*.{ts,tsx}',
      'apps/oasis/src/**/*.{ts,tsx}',
      'packages/chrome/src/**/*.{ts,tsx}',
    ],
    extends: [reactHooks.configs.flat['recommended-latest']],
    languageOptions: { globals: globals.browser },
  },
  {
    files: [
      'tools/**/*.ts',
      'tests/**/*.ts',
      '*.config.{js,ts}',
      'apps/web/vite.config.ts',
      'apps/oasis/vite.config.ts',
    ],
    languageOptions: { globals: globals.node },
  },
);
