import { defineWorker } from '../../../src/infrastructure/runtime/worker-runtime.js';

export const auditWorker = defineWorker({
  name: 'audit-worker',
  queue: 'pms.audit.workflow-action-recorded.v1',
  deadLetterQueue: 'pms.audit.workflow-action-recorded.v1.dlq',
  concurrency: 1,
});
