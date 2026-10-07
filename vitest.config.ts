import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Architecture checks traverse the complete source tree and may share I/O
    // with integration suites on a developer workstation.
    testTimeout: 15_000,
    include: [
      'tests/**/*.spec.ts',
      'apps/**/*.spec.ts',
      'libs/**/*.spec.ts',
      'packages/**/*.spec.ts',
    ],
  },
});
