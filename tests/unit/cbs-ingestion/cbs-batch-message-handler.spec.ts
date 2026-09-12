import { describe, expect, it, vi } from 'vitest';

import { CbsBatchMessageHandler } from '../../../apps/ingestion-worker/src/cbs-batch-message-handler.js';
import type { InboxRepository, OutboxMessage } from '../../../src/infrastructure/messaging/message-contracts.js';
import { RegisterCbsBatch } from '../../../src/modules/cbs-ingestion/application/register-cbs-batch.js';
import { AuthenticateCbsManifest } from '../../../src/modules/cbs-ingestion/application/authenticate-cbs-manifest.js';

const message: OutboxMessage = {
  eventId: '17146c36-a0cb-4e0a-b095-60b67c945eb9',
  eventType: 'pms.cbs.batch.received.v1', correlationId: 'a1d817e4-657f-475f-a96a-7eecb8f93acc',
  aggregateType: 'CbsBatch', aggregateId: 'batch-1', schemaVersion: 1,
  occurredAt: '2026-08-28T00:00:00.000Z',
  payload: { batchId: '17146c36-a0cb-4e0a-b095-60b67c945eb9', source: 'CBS', businessDate: '2026-08-28', flowType: 'BALANCES',
    sequence: 7, checksumSha256: 'a'.repeat(64), objectKey: 'cbs/2026-08-28/7.csv',
    manifestRowCount: 2, manifestBalanceTotal: '1500.00',
    signatureBase64: Buffer.alloc(64, 1).toString('base64'), receivedAt: '2026-08-29T02:00:00.000Z' },
};

describe('CbsBatchMessageHandler', () => {
  it('registers a valid event through Inbox idempotence', async () => {
    const save = vi.fn().mockResolvedValue({
      status: 'CREATED', batchId: message.payload['batchId'], state: 'RECEIVED',
    });
    const inbox: InboxRepository = {
      begin: async () => true, complete: async () => undefined, abandon: async () => undefined,
    };
    const repository = { registerReceived: save, transition: async () => undefined };
    const handler = new CbsBatchMessageHandler(
      inbox, new RegisterCbsBatch(repository), undefined, undefined, undefined, undefined,
      new AuthenticateCbsManifest({ verify: async () => true }, { recordAuthentication: async () => undefined }, { startHourUtc: 1, endHourUtc: 4 }),
    );
    await expect(handler.handle(message)).resolves.toBe('PROCESSED');
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ source: 'CBS', sequence: 7 }));
  });
});
