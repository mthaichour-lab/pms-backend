import { describe, expect, it, vi } from 'vitest';

import { PostgresAuditTrailRepository } from '../../../src/infrastructure/persistence/postgres-audit-trail.repository.js';
import type { SqlClient } from '../../../src/infrastructure/persistence/postgres-client.js';

describe('PostgresAuditTrailRepository', () => {
  it('loads a bounded chronological segment and maps nullable evidence fields', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{
      audit_event_id: '4ad5de42-e1c5-466a-bd79-f874fdc7ddbe', previous_hash: null,
      event_hash: 'a'.repeat(64), signing_key_id: 'kms-key-1', signature_base64: 'c2lnbmF0dXJl',
      correlation_id: '65aeb69d-73a7-4f04-9578-5fa8326f654f', actor_id: 'auditor-1', technical_identity: 'pms-api', session_id: null,
      action: 'AUDIT_VIEWED', resource_type: 'AuditTrail', resource_id: 'trail-1', outcome: 'SUCCESS',
      business_date: '2026-09-09', occurred_at: new Date('2026-09-09T08:00:00.000Z'), source_application: 'pms-api',
      source_address: null, justification: null, run_id: null, batch_id: null, document_reference_id: null, authorized_changes: null,
      matches_filter: true, predecessor_exists: true,
    }] });
    const repository = new PostgresAuditTrailRepository({ query } as unknown as SqlClient);

    await expect(repository.latestWindow(250, { action: 'APPROVE_CALCULATION', outcome: 'SUCCESS', correlationId: '65aeb69d-73a7-4f04-9578-5fa8326f654f', businessDateFrom: '2026-09-01', businessDateTo: '2026-09-09' })).resolves.toEqual({
      events: [expect.objectContaining({ auditEventId: '4ad5de42-e1c5-466a-bd79-f874fdc7ddbe', occurredAt: '2026-09-09T08:00:00.000Z', outcome: 'SUCCESS' })],
      matches: [true], predecessorExists: [true],
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('action = $2'), [250, 'APPROVE_CALCULATION', 'SUCCESS', '65aeb69d-73a7-4f04-9578-5fa8326f654f', '2026-09-01', '2026-09-09']);
    expect(query.mock.calls[0]![0]).toContain('outcome = $3');
    expect(query.mock.calls[0]![0]).toContain('correlation_id = $4::uuid');
    expect(query.mock.calls[0]![0]).toContain('business_date >= $5::date');
    expect(query.mock.calls[0]![0]).toContain('business_date <= $6::date');
    expect(query.mock.calls[0]![0]).toContain('(predecessor.created_at, predecessor.audit_event_id) < (latest.created_at, latest.audit_event_id)');
    expect(query.mock.calls[0]![0]).toContain('ORDER BY predecessor.created_at DESC, predecessor.audit_event_id DESC LIMIT 1');
  });

  it('rejects an old existing hash when it is not the immediate predecessor', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{
      audit_event_id: '4ad5de42-e1c5-466a-bd79-f874fdc7ddbe', previous_hash: 'a'.repeat(64), event_hash: 'b'.repeat(64),
      signing_key_id: 'kms-key-1', signature_base64: 'c2ln', correlation_id: '65aeb69d-73a7-4f04-9578-5fa8326f654f',
      actor_id: 'auditor-1', technical_identity: 'pms-api', session_id: null, action: 'AUDIT_VIEWED', resource_type: 'AuditTrail',
      resource_id: 'trail-1', outcome: 'SUCCESS', business_date: '2026-09-09', occurred_at: new Date('2026-09-09T08:00:00.000Z'),
      source_application: 'pms-api', source_address: null, justification: null, run_id: null, batch_id: null,
      document_reference_id: null, authorized_changes: null, matches_filter: true, predecessor_exists: false,
    }] });
    const window = await new PostgresAuditTrailRepository({ query } as unknown as SqlClient).latestWindow(25, {});
    expect(window.predecessorExists).toEqual([false]);
    expect(query.mock.calls[0]![0]).toContain('previous_hash IS NOT DISTINCT FROM');
  });
});
