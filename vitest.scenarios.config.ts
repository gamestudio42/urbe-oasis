import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/scenarios/**/*.scenario.ts'],
    environment: 'node',
    testTimeout: 120_000,
  },
});
