import { describe, expect, it, vi } from 'vitest';

import { CalculationMessageHandler } from '../../../apps/calculation-worker/src/calculation-message-handler.js';
import type { InboxRepository, OutboxMessage } from '../../../src/infrastructure/messaging/message-contracts.js';
import { ExecuteProfitCalculation } from '../../../src/modules/profit-calculation/application/execute-profit-calculation.js';

describe('CalculationMessageHandler', () => {
  it('executes a contracted request through Inbox idempotence', async () => {
    const executeAtomically = vi.fn().mockResolvedValue({
      status: 'CALCULATED', outputChecksumSha256: 'a'.repeat(64),
    });
    const inbox: InboxRepository = {
      begin: async () => true, complete: async () => undefined, abandon: async () => undefined,
    };
    const handler = new CalculationMessageHandler(inbox, new ExecuteProfitCalculation({ executeAtomically }));
    const message: OutboxMessage = {
      eventId: 'f8909fee-5cba-42c7-bd89-3776dfda81a9',
      eventType: 'pms.calculation.requested.v1', correlationId: 'a1d817e4-657f-475f-a96a-7eecb8f93acc',
      aggregateType: 'CalculationRun', aggregateId: '17146c36-a0cb-4e0a-b095-60b67c945eb9',
      schemaVersion: 1, occurredAt: '2026-08-28T00:00:00.000Z',
      payload: { runId: '17146c36-a0cb-4e0a-b095-60b67c945eb9', poolId: 'POOL-DZD-1',
        businessDate: '2026-08-28', rulesVersion: 'rules-2026.1', requestedBy: 'maker-1' },
    };
    await expect(handler.handle(message)).resolves.toBe('PROCESSED');
    expect(executeAtomically).toHaveBeenCalledOnce();
  });
});
