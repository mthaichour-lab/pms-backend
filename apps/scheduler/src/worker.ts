import { defineWorker } from '../../../src/infrastructure/runtime/worker-runtime.js';

export const scheduler = defineWorker({
  name: 'scheduler',
  concurrency: 1,
});

export const scheduledJobs = Object.freeze([
  'access-review-scan',
  'outbox-relay',
  'expected-cbs-batch-check',
] as const);
