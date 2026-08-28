import { defineWorker } from '../../../src/infrastructure/runtime/worker-runtime.js';

export const ingestionWorker = defineWorker({
  name: 'ingestion-worker',
  queue: 'pms.cbs.batch.received.v1',
  deadLetterQueue: 'pms.cbs.batch.received.v1.dlq',
  concurrency: 2,
});
