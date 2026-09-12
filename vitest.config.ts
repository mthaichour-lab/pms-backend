import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'tests/**/*.spec.ts',
      'apps/**/*.spec.ts',
      'libs/**/*.spec.ts',
      'packages/**/*.spec.ts',
    ],
  },
});
