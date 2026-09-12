import { describe, expect, it } from 'vitest';

import { QueryAuditTrail } from '../../../src/modules/audit/application/query-audit-trail.js';
import {
  createSignedAuditEvent,
  type AuditEventDraft,
  type AuditSigner,
  type SignedAuditEvent,
} from '../../../src/modules/audit/domain/audit-chain.js';

const signer: AuditSigner = {
  keyId: () => 'kms-audit-key-1',
  signSha256Digest: async (digest) => new Uint8Array(digest),
};
const auditWindow = (events: readonly SignedAuditEvent[], matches = events.map(() => true), predecessorExists = events.map(() => true)) => ({ events, matches, predecessorExists });

function draft(auditEventId: string, action: string): AuditEventDraft {
  return {
    auditEventId,
    correlationId: '65aeb69d-73a7-4f04-9578-5fa8326f654f',
    actorId: 'auditor-1',
    technicalIdentity: 'pms-api',
    action,
    resourceType: 'AuditTrail',
    resourceId: 'audit-trail-1',
    outcome: 'SUCCESS',
    businessDate: '2026-09-09',
    occurredAt: '2026-09-09T08:00:00.000Z',
    sourceApplication: 'pms-api',
  };
}

describe('QueryAuditTrail', () => {
  it('verifies the hashes and links in a chronological segment', async () => {
    const first = await createSignedAuditEvent(draft('4ad5de42-e1c5-466a-bd79-f874fdc7ddbe', 'AUDIT_STARTED'), undefined, signer);
    const second = await createSignedAuditEvent(draft('e958fe1c-6f30-45fa-9819-2239dc953957', 'AUDIT_COMPLETED'), first.eventHash, signer);
    const query = new QueryAuditTrail({ latestWindow: async () => auditWindow([first, second]) });

    await expect(query.execute(25)).resolves.toEqual({
      events: [first, second],
      integrity: 'HASH_CHAIN',
      chainValid: true,
      verifiedCount: 2,
    });
  });

  it('reports the first event whose link was altered', async () => {
    const first = await createSignedAuditEvent(draft('4ad5de42-e1c5-466a-bd79-f874fdc7ddbe', 'AUDIT_STARTED'), undefined, signer);
    const second = await createSignedAuditEvent(draft('e958fe1c-6f30-45fa-9819-2239dc953957', 'AUDIT_COMPLETED'), first.eventHash, signer);
    const corrupted = { ...second, previousHash: 'f'.repeat(64) };
    const query = new QueryAuditTrail({ latestWindow: async () => auditWindow([first, corrupted]) });

    await expect(query.execute()).resolves.toMatchObject({
      chainValid: false,
      verifiedCount: 1,
      brokenAtEventId: corrupted.auditEventId,
    });
  });

  it('rejects limits outside the bounded audit window', async () => {
    const query = new QueryAuditTrail({ latestWindow: async () => auditWindow([]) });
    await expect(query.execute(201)).rejects.toThrow(RangeError);
  });

  it('validates filters and preserves hash verification for non-contiguous filtered results', async () => {
    const first = await createSignedAuditEvent(draft('4ad5de42-e1c5-466a-bd79-f874fdc7ddbe', 'AUDIT_STARTED'), undefined, signer);
    const second = await createSignedAuditEvent(draft('e958fe1c-6f30-45fa-9819-2239dc953957', 'AUDIT_COMPLETED'), first.eventHash, signer);
    const latestWindow = async () => auditWindow([first, second], [false, true]);
    await expect(new QueryAuditTrail({ latestWindow }).execute(25, { action: 'AUDIT_COMPLETED' })).resolves.toMatchObject({ events: [second], chainValid: true, verifiedCount: 2 });
    await expect(new QueryAuditTrail({ latestWindow }).execute(25, { correlationId: 'invalid' })).rejects.toThrow('correlation');
    await expect(new QueryAuditTrail({ latestWindow }).execute(25, { businessDateFrom: '2026-02-30' })).rejects.toThrow('businessDateFrom');
    await expect(new QueryAuditTrail({ latestWindow }).execute(25, { businessDateFrom: '2026-09-10', businessDateTo: '2026-09-09' })).rejects.toThrow('inverted');
  });

  it('rejects a filtered window when a predecessor is missing', async () => {
    const event = await createSignedAuditEvent(draft('4ad5de42-e1c5-466a-bd79-f874fdc7ddbe', 'AUDIT_COMPLETED'), 'b'.repeat(64), signer);
    const query = new QueryAuditTrail({ latestWindow: async () => auditWindow([event], [true], [false]) });
    await expect(query.execute(25, { action: 'AUDIT_COMPLETED' })).resolves.toMatchObject({ chainValid: false, verifiedCount: 0, brokenAtEventId: event.auditEventId });
  });

  it('caps a filtered verification window at two thousand events', async () => {
    let requestedScanLimit = 0;
    const query = new QueryAuditTrail({ latestWindow: async (scanLimit) => { requestedScanLimit = scanLimit; return auditWindow([]); } });
    await query.execute(200, { outcome: 'SUCCESS' });
    expect(requestedScanLimit).toBe(2_000);
  });
});
