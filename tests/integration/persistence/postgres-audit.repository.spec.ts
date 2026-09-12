import { describe, expect, it, vi } from 'vitest';

import { PostgresAuditRepository } from '../../../src/infrastructure/persistence/postgres-audit.repository.js';
import type { AuditSigner } from '../../../src/modules/audit/domain/audit-chain.js';

describe('PostgresAuditRepository', () => {
  it('serializes, signs and commits an event linked to the latest hash', async () => {
    const query = vi.fn(async (sql: string) => sql.includes('WHERE audit_event_id')
      ? { rows: [] }
      : sql.startsWith('SELECT event_hash')
      ? { rows: [{ event_hash: 'a'.repeat(64) }] }
      : { rows: [], rowCount: 1 });
    const release = vi.fn();
    const pool = { connect: async () => ({ query, release }) };
    const signer: AuditSigner = {
      keyId: () => 'kms-audit-key',
      signSha256Digest: async (digest) => new Uint8Array(digest),
    };
    const repository = new PostgresAuditRepository(pool as never, signer);

    const event = await repository.append({
      auditEventId: '4ad5de42-e1c5-466a-bd79-f874fdc7ddbe',
      correlationId: '65aeb69d-73a7-4f04-9578-5fa8326f654f',
      actorId: 'auditor-1', technicalIdentity: 'pms-api', action: 'READ_AUDIT_TRAIL',
      resourceType: 'AuditTrail', resourceId: 'latest:50', outcome: 'SUCCESS',
      businessDate: '2026-09-09', occurredAt: '2026-09-09T12:00:00.000Z', sourceApplication: 'pms-api',
    });

    expect(event.previousHash).toBe('a'.repeat(64));
    expect(event.signingKeyId).toBe('kms-audit-key');
    expect(query.mock.calls.map(([sql]) => sql)).toEqual(expect.arrayContaining([
      'BEGIN',
      "SELECT pg_advisory_xact_lock(hashtext('pms.audit.chain'))",
      'COMMIT',
    ]));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO audit.event'), expect.arrayContaining([
      event.auditEventId, event.previousHash, event.eventHash, event.signingKeyId, event.signatureBase64,
    ]));
    expect(release).toHaveBeenCalledOnce();
  });

  it('rolls back and releases the connection if signing fails', async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const release = vi.fn();
    const repository = new PostgresAuditRepository(
      { connect: async () => ({ query, release }) } as never,
      { keyId: () => 'kms-audit-key', signSha256Digest: async () => { throw new Error('KMS unavailable'); } },
    );

    await expect(repository.append({
      auditEventId: '4ad5de42-e1c5-466a-bd79-f874fdc7ddbe',
      correlationId: '65aeb69d-73a7-4f04-9578-5fa8326f654f',
      actorId: 'auditor-1', technicalIdentity: 'pms-api', action: 'READ_AUDIT_TRAIL',
      resourceType: 'AuditTrail', resourceId: 'latest:50', outcome: 'SUCCESS',
      businessDate: '2026-09-09', occurredAt: '2026-09-09T12:00:00.000Z', sourceApplication: 'pms-api',
    })).rejects.toThrow('KMS unavailable');
    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledOnce();
  });

  it('returns an identical event replay without signing or inserting it again', async () => {
    const draft = {
      auditEventId: '4ad5de42-e1c5-466a-bd79-f874fdc7ddbe',
      correlationId: '65aeb69d-73a7-4f04-9578-5fa8326f654f',
      actorId: 'checker-1', technicalIdentity: 'audit-worker', action: 'APPROVE_CLOSING',
      resourceType: 'ClosingPeriod', resourceId: '17146c36-a0cb-4e0a-b095-60b67c945eb9',
      outcome: 'SUCCESS' as const, businessDate: '2026-09-09',
      occurredAt: '2026-09-09T12:00:00.000Z', sourceApplication: 'pms-api',
    };
    const { calculateAuditHash } = await import('../../../src/modules/audit/domain/audit-chain.js');
    const previousHash = 'a'.repeat(64);
    const eventHash = calculateAuditHash(draft, previousHash);
    const query = vi.fn(async (sql: string) => sql.includes('WHERE audit_event_id')
      ? { rows: [{ previous_hash: previousHash, event_hash: eventHash, signing_key_id: 'kms-key', signature_base64: 'c2ln' }] }
      : { rows: [] });
    const signSha256Digest = vi.fn();
    const repository = new PostgresAuditRepository(
      { connect: async () => ({ query, release: vi.fn() }) } as never,
      { keyId: () => 'kms-key', signSha256Digest },
    );

    await expect(repository.append(draft)).resolves.toMatchObject({ eventHash, previousHash });
    expect(signSha256Digest).not.toHaveBeenCalled();
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO audit.event'))).toBe(false);
    expect(query).toHaveBeenCalledWith('COMMIT');
  });

  it('rejects reuse of an audit identifier with a different payload', async () => {
    const query = vi.fn(async (sql: string) => sql.includes('WHERE audit_event_id')
      ? { rows: [{ previous_hash: null, event_hash: 'b'.repeat(64), signing_key_id: 'kms-key', signature_base64: 'c2ln' }] }
      : { rows: [] });
    const repository = new PostgresAuditRepository(
      { connect: async () => ({ query, release: vi.fn() }) } as never,
      { keyId: () => 'kms-key', signSha256Digest: vi.fn() },
    );

    await expect(repository.append({
      auditEventId: '4ad5de42-e1c5-466a-bd79-f874fdc7ddbe',
      correlationId: '65aeb69d-73a7-4f04-9578-5fa8326f654f',
      actorId: 'checker-1', technicalIdentity: 'audit-worker', action: 'APPROVE_CLOSING',
      resourceType: 'ClosingPeriod', resourceId: '17146c36-a0cb-4e0a-b095-60b67c945eb9',
      outcome: 'SUCCESS', businessDate: '2026-09-09', occurredAt: '2026-09-09T12:00:00.000Z',
      sourceApplication: 'pms-api',
    })).rejects.toThrow('different payload');
    expect(query).toHaveBeenCalledWith('ROLLBACK');
  });
});
