import { describe, expect, it, vi } from 'vitest';
import { AuditMessageHandler } from '../../../apps/audit-worker/src/audit-message-handler.js';
import type { InboxRepository, OutboxMessage } from '../../../src/infrastructure/messaging/message-contracts.js';

const message: OutboxMessage = {
  eventId: '4ad5de42-e1c5-466a-bd79-f874fdc7ddbe', eventType: 'pms.audit.workflow-action-recorded.v1', schemaVersion: 1,
  aggregateType: 'CalculationRun', aggregateId: 'e958fe1c-6f30-45fa-9819-2239dc953957',
  correlationId: '65aeb69d-73a7-4f04-9578-5fa8326f654f', occurredAt: '2026-09-09T08:00:00.000Z',
  payload: { resourceType: 'CalculationRun', resourceId: 'e958fe1c-6f30-45fa-9819-2239dc953957', action: 'APPROVE_CALCULATION', actorId: 'checker-1', justification: 'Calculation approved after controls', resultState: 'APPROVED', businessDate: '2026-09-09' },
};

function inbox(begin = true): InboxRepository {
  return { begin: vi.fn(async () => begin), complete: vi.fn(async () => undefined), abandon: vi.fn(async () => undefined) };
}

describe('AuditMessageHandler', () => {
  it('appends a signed audit event and completes the inbox with its hash', async () => {
    const store = inbox();
    const append = vi.fn(async (draft) => ({ ...draft, eventHash: 'a'.repeat(64), signingKeyId: 'kms-key', signatureBase64: 'c2ln' }));
    const handler = new AuditMessageHandler(store, { append });
    await expect(handler.handle(message)).resolves.toBe('PROCESSED');
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ auditEventId: message.eventId, actorId: 'checker-1', technicalIdentity: 'audit-worker', outcome: 'SUCCESS', authorizedChanges: { state: { after: 'APPROVED' } } }));
    expect(store.complete).toHaveBeenCalledWith('audit-worker', message.eventId, 'a'.repeat(64));
  });

  it('does not append a duplicate delivery', async () => {
    const append = vi.fn();
    await expect(new AuditMessageHandler(inbox(false), { append }).handle(message)).resolves.toBe('DUPLICATE');
    expect(append).not.toHaveBeenCalled();
  });

  it('abandons the inbox lease when the payload is invalid', async () => {
    const store = inbox();
    const invalid = { ...message, payload: { ...message.payload, actorId: '' } };
    await expect(new AuditMessageHandler(store, { append: vi.fn() }).handle(invalid)).rejects.toThrow('actorId');
    expect(store.abandon).toHaveBeenCalledWith('audit-worker', message.eventId);
  });
});
