import { describe, expect, it, vi } from 'vitest';

import { IdempotentConsumer } from '../../../src/infrastructure/messaging/idempotent-consumer.js';
import type {
  InboxRepository,
  OutboxRecord,
  OutboxRepository,
} from '../../../src/infrastructure/messaging/message-contracts.js';
import { OutboxRelay } from '../../../src/infrastructure/messaging/outbox-relay.js';

const message: OutboxRecord = {
  eventId: '65cefa12-1941-40ca-9826-e6b024da75af',
  eventType: 'pms.calculation.requested.v1',
  schemaVersion: 1,
  aggregateType: 'CalculationRun',
  aggregateId: 'run-1',
  correlationId: 'b870f4cb-4343-4074-b56f-438642c18876',
  occurredAt: '2026-08-28T00:00:00.000Z',
  availableAt: '2026-08-28T00:00:00.000Z',
  createdAt: '2026-08-28T00:00:00.000Z',
  publishAttempts: 0,
  payload: { runId: 'run-1' },
};

describe('OutboxRelay', () => {
  it('marks an event published only after broker acknowledgement', async () => {
    const repository = repositoryWith([message]);
    const publish = vi.fn().mockResolvedValue(undefined);
    const relay = new OutboxRelay(repository, { publish });

    await expect(relay.runBatch(10, '2026-08-28T00:00:00.000Z')).resolves.toEqual({
      published: [message.eventId],
      failed: [],
    });
    expect(publish).toHaveBeenCalledWith(message);
    expect(repository.markPublished).toHaveBeenCalledAfter(publish);
  });

  it('schedules a bounded retry without marking a failed event published', async () => {
    const repository = repositoryWith([{ ...message, publishAttempts: 2 }]);
    const relay = new OutboxRelay(repository, {
      publish: vi.fn().mockRejectedValue(new Error('broker unavailable')),
    });

    await expect(relay.runBatch(10, '2026-08-28T00:00:00.000Z')).resolves.toEqual({
      published: [],
      failed: [message.eventId],
    });
    expect(repository.markPublished).not.toHaveBeenCalled();
    expect(repository.markFailed).toHaveBeenCalledWith(
      message.eventId,
      '2026-08-28T00:00:20.000Z',
      'broker unavailable',
    );
  });
});

describe('IdempotentConsumer', () => {
  it('does not execute the business effect for an Inbox duplicate', async () => {
    const effect = vi.fn();
    const inbox: InboxRepository = {
      begin: vi.fn().mockResolvedValue(false),
      complete: vi.fn(),
      abandon: vi.fn(),
    };
    const consumer = new IdempotentConsumer('calculation-worker', inbox);

    await expect(consumer.handle(message, effect)).resolves.toBe('DUPLICATE');
    expect(effect).not.toHaveBeenCalled();
  });
});

function repositoryWith(records: readonly OutboxRecord[]): OutboxRepository & {
  markPublished: ReturnType<typeof vi.fn>;
  markFailed: ReturnType<typeof vi.fn>;
} {
  return {
    claimPending: vi.fn().mockResolvedValue(records),
    markPublished: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
  };
}
