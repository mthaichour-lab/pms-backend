import { describe, expect, it } from 'vitest';

import { calculationWorker } from '../../apps/calculation-worker/src/worker.js';
import { closingWorker } from '../../apps/closing-worker/src/worker.js';
import { documentWorker } from '../../apps/document-worker/src/worker.js';
import { ingestionWorker } from '../../apps/ingestion-worker/src/worker.js';
import { scheduledJobs, scheduler } from '../../apps/scheduler/src/worker.js';

describe('specialized process architecture', () => {
  const workers = [
    calculationWorker,
    ingestionWorker,
    closingWorker,
    documentWorker,
    scheduler,
  ];

  it('gives every execution unit a unique workload identity', () => {
    expect(new Set(workers.map((worker) => worker.name)).size).toBe(workers.length);
  });

  it('gives every RabbitMQ consumer a dedicated DLQ', () => {
    for (const worker of workers.filter((candidate) => candidate.queue)) {
      expect(worker.deadLetterQueue).toBe(`${worker.queue}.dlq`);
    }
  });

  it('runs periodic responsibilities only from the dedicated scheduler', () => {
    expect(scheduler.queue).toBeUndefined();
    expect(scheduledJobs).toContain('access-review-scan');
    expect(scheduledJobs).toContain('outbox-relay');
  });
});
