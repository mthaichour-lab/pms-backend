import { describe, expect, it, vi } from 'vitest';

import { PostgresSecureExportRepository } from '../../../src/infrastructure/persistence/postgres-secure-export.repository.js';
import { exportChecksum, type ExportDataset } from '../../../src/modules/reporting/domain/secure-export.js';

const exportId = '7dcc813a-4cb9-4b38-a49d-bbb7fd15330e';
const otherExportId = '47f65a0b-b68a-4ad1-ad5d-cce13648365f';
const correlationId = '65aeb69d-73a7-4f04-9578-5fa8326f654f';
const dataset: ExportDataset = {
  columns: [{ key: 'amount', label: 'Amount' }], rows: [{ amount: 10 }],
};

function repositoryWith(query: ReturnType<typeof vi.fn>, release = vi.fn()) {
  return {
    repository: new PostgresSecureExportRepository({
      connect: async () => ({ query, release }),
    } as never),
    release,
  };
}

describe('PostgresSecureExportRepository', () => {
  it('serializes create idempotency and writes audit intent before commit', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM reporting.secure_export WHERE idempotency_key')) return { rows: [] };
      if (sql.includes('INSERT INTO reporting.secure_export\n')) return { rows: [{
        export_id: exportId, report_type: 'POSITION_REPORT', format: 'PDF', scope: 'SINGLE',
        status: 'APPROVED', filters: { asOf: '2026-09-14' }, requester_id: 'maker',
        approved_by: null, expired: false,
      }] };
      return { rows: [], rowCount: 1 };
    });
    const { repository, release } = repositoryWith(query);
    await expect(repository.create({
      reportType: 'POSITION_REPORT', format: 'PDF', scope: 'SINGLE',
      filters: { asOf: '2026-09-14' }, requesterId: 'maker', idempotencyKey: 'export-create-0001', correlationId,
    }, 'APPROVED')).resolves.toEqual({ exportId, status: 'APPROVED' });
    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements[1]).toContain('pg_advisory_xact_lock');
    const auditIndex = statements.findIndex((sql) => sql.includes('INSERT INTO integration.outbox_event'));
    expect(auditIndex).toBeGreaterThan(0);
    expect(auditIndex).toBeLessThan(statements.indexOf('COMMIT'));
    expect((query.mock.calls[auditIndex] as unknown[])[1]).toEqual(expect.arrayContaining([correlationId]));
    expect(release).toHaveBeenCalledOnce();
  });

  it('rejects a create replay with different filters', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM reporting.secure_export WHERE idempotency_key')) return { rows: [{
        export_id: exportId, report_type: 'POSITION_REPORT', format: 'PDF', scope: 'SINGLE',
        status: 'APPROVED', filters: { asOf: '2026-09-13' }, requester_id: 'maker',
        approved_by: null, expired: false,
      }] };
      return { rows: [], rowCount: 1 };
    });
    const { repository } = repositoryWith(query);
    await expect(repository.create({
      reportType: 'POSITION_REPORT', format: 'PDF', scope: 'SINGLE',
      filters: { asOf: '2026-09-14' }, requesterId: 'maker', idempotencyKey: 'export-create-0001', correlationId,
    }, 'APPROVED')).rejects.toThrow('replay payload differs');
    expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  });

  it('replays the original creation status after the aggregate has advanced', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM reporting.secure_export WHERE idempotency_key')) return { rows: [{
        export_id: exportId, report_type: 'POSITION_REPORT', format: 'PDF', scope: 'SINGLE',
        status: 'GENERATED', filters: {}, requester_id: 'maker', approved_by: null, expired: false,
      }] };
      return { rows: [], rowCount: 1 };
    });
    const { repository } = repositoryWith(query);
    await expect(repository.create({
      reportType: 'POSITION_REPORT', format: 'PDF', scope: 'SINGLE', filters: {},
      requesterId: 'maker', idempotencyKey: 'export-create-0001', correlationId,
    }, 'APPROVED')).resolves.toEqual({ exportId, status: 'APPROVED' });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('integration.outbox_event'))).toBe(false);
  });

  it('validates approval replay resource and actor without duplicating audit', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM reporting.secure_export_event')) return { rows: [{
        export_id: otherExportId, action: 'REINFORCED_APPROVAL', actor_id: 'checker',
        resulting_status: 'APPROVED',
      }] };
      return { rows: [], rowCount: 1 };
    });
    const { repository } = repositoryWith(query);
    await expect(repository.approve(exportId, 'checker', 'export-approve-001', correlationId, vi.fn()))
      .rejects.toThrow('action replay payload differs');
    expect(query.mock.calls.some(([sql]) => String(sql).includes('integration.outbox_event'))).toBe(false);
  });

  it('rejects an expired request before approval', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM reporting.secure_export_event')) return { rows: [] };
      if (sql.includes('FOR UPDATE')) return { rows: [{
        export_id: exportId, scope: 'BULK', status: 'PENDING_REINFORCED_APPROVAL',
        requester_id: 'maker', expired: true,
      }] };
      return { rows: [], rowCount: 1 };
    });
    const { repository } = repositoryWith(query);
    await expect(repository.approve(exportId, 'checker', 'export-approve-001', correlationId, vi.fn()))
      .rejects.toThrow('has expired');
  });

  it('approves a pending bulk export and records a correlated audit intent atomically', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM reporting.secure_export_event')) return { rows: [] };
      if (sql.includes('FOR UPDATE')) return { rows: [{
        export_id: exportId, report_type: 'POSITION_REPORT', format: 'PDF', scope: 'BULK',
        status: 'PENDING_REINFORCED_APPROVAL', filters: {}, requester_id: 'maker',
        approved_by: null, expired: false,
      }] };
      return { rows: [], rowCount: 1 };
    });
    const { repository } = repositoryWith(query);
    await expect(repository.approve(
      exportId, 'checker', 'export-approve-001', correlationId,
      () => 'APPROVED',
    )).resolves.toEqual({ status: 'APPROVED' });
    const auditCall = query.mock.calls.find(([sql]) => String(sql).includes('integration.outbox_event'));
    expect((auditCall as unknown[])[1]).toEqual(expect.arrayContaining([correlationId]));
    expect(query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
  });

  it('detects a corrupted generated artifact on idempotent replay', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('generation_idempotency_key')) return { rows: [{
        export_id: exportId, generated_by: 'maker', output_manifest: dataset,
        output_checksum_sha256: '0'.repeat(64), expired: false,
      }] };
      return { rows: [], rowCount: 1 };
    });
    const { repository } = repositoryWith(query);
    await expect(repository.generate(
      exportId, 'maker', dataset, exportChecksum(dataset), 'export-generate-01', correlationId,
    )).rejects.toThrow('artifact integrity differs');
    expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  });

  it('enforces requester generation and distinct bulk approval', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('generation_idempotency_key')) return { rows: [] };
      if (sql.includes('FOR UPDATE')) return { rows: [{
        export_id: exportId, scope: 'BULK', status: 'APPROVED', requester_id: 'maker',
        approved_by: 'maker', expired: false,
      }] };
      return { rows: [], rowCount: 1 };
    });
    const { repository } = repositoryWith(query);
    await expect(repository.generate(
      exportId, 'maker', dataset, exportChecksum(dataset), 'export-generate-01', correlationId,
    )).rejects.toThrow('distinct checker');
  });

  it('generates the canonical artifact and records a correlated audit intent atomically', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('generation_idempotency_key') && sql.includes('SELECT')) return { rows: [] };
      if (sql.includes('FOR UPDATE')) return { rows: [{
        export_id: exportId, report_type: 'POSITION_REPORT', format: 'PDF', scope: 'SINGLE',
        status: 'APPROVED', filters: {}, requester_id: 'maker', approved_by: null, expired: false,
      }] };
      return { rows: [], rowCount: 1 };
    });
    const { repository } = repositoryWith(query);
    const checksum = exportChecksum(dataset);
    await expect(repository.generate(
      exportId, 'maker', dataset, checksum, 'export-generate-01', correlationId,
    )).resolves.toEqual({ exportId, status: 'GENERATED', checksumSha256: checksum });
    const auditCall = query.mock.calls.find(([sql]) => String(sql).includes('integration.outbox_event'));
    expect((auditCall as unknown[])[1]).toEqual(expect.arrayContaining([correlationId]));
    expect(query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
  });

  it('does not issue rollback when beginning the transaction fails', async () => {
    const release = vi.fn();
    const query = vi.fn(async (sql: string) => {
      if (sql === 'BEGIN') throw new Error('connection lost');
      return { rows: [] };
    });
    const { repository } = repositoryWith(query, release);
    await expect(repository.create({
      reportType: 'POSITION_REPORT', format: 'PDF', scope: 'SINGLE', filters: {},
      requesterId: 'maker', idempotencyKey: 'export-create-0001', correlationId,
    }, 'APPROVED')).rejects.toThrow('connection lost');
    expect(query).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledOnce();
  });
});
