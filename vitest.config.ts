import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    // Keep seeded multi-city tests within their timeout on shared development machines.
    maxWorkers: 2,
  },
});
