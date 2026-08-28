import { defineWorker, type WorkerDefinition } from '../../../src/infrastructure/runtime/worker-runtime.js';

export const documentWorker = defineWorker({
  name: 'document-worker',
  queue: 'pms.document.archive-requested.v1',
  deadLetterQueue: 'pms.document.archive-requested.v1.dlq',
  concurrency: 2,
}) as WorkerDefinition & { queue: string; deadLetterQueue: string };
