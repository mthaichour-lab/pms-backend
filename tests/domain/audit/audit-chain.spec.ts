import { describe, expect, it } from 'vitest';

import {
  createSignedAuditEvent,
  verifyAuditHash,
  type AuditEventDraft,
  type AuditSigner,
} from '../../../src/modules/audit/domain/audit-chain.js';

const draft: AuditEventDraft = {
  auditEventId: '17146c36-a0cb-4e0a-b095-60b67c945eb9',
  correlationId: 'a1d817e4-657f-475f-a96a-7eecb8f93acc',
  actorId: 'user-1',
  technicalIdentity: 'pms-api',
  action: 'POOL_OPERATION_APPROVED',
  resourceType: 'PoolOperation',
  resourceId: 'operation-1',
  outcome: 'SUCCESS',
  businessDate: '2026-08-28',
  occurredAt: '2026-08-28T00:00:00.000Z',
  sourceApplication: 'pms-api',
  authorizedChanges: { status: { before: 'PENDING', after: 'APPROVED' } },
};
const signer: AuditSigner = {
  keyId: () => 'hsm-key-1',
  signSha256Digest: async (digest) => new Uint8Array([...digest].reverse()),
};

describe('audit hash chain', () => {
  it('produces a deterministic hash and a signer-bound proof', async () => {
    const first = await createSignedAuditEvent(draft, undefined, signer);
    const second = await createSignedAuditEvent(draft, undefined, signer);

    expect(first.eventHash).toBe(second.eventHash);
    expect(first.signatureBase64).not.toBe('');
    expect(first.signingKeyId).toBe('hsm-key-1');
    expect(verifyAuditHash(first)).toBe(true);
  });

  it('detects any mutation of an authorized field', async () => {
    const event = await createSignedAuditEvent(draft, 'a'.repeat(64), signer);

    expect(verifyAuditHash({ ...event, outcome: 'FAILURE' })).toBe(false);
  });
});
