import { defineWorker } from '../../../src/infrastructure/runtime/worker-runtime.js';

export const closingWorker = defineWorker({
  name: 'closing-worker',
  queue: 'pms.closing.requested.v1',
  deadLetterQueue: 'pms.closing.requested.v1.dlq',
  concurrency: 1,
});
