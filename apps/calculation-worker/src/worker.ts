import { defineWorker } from '../../../src/infrastructure/runtime/worker-runtime.js';

export const calculationWorker = defineWorker({
  name: 'calculation-worker',
  queue: 'pms.calculation.requested.v1',
  deadLetterQueue: 'pms.calculation.requested.v1.dlq',
  concurrency: 4,
});
