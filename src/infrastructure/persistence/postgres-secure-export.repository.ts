import type { Pool, PoolClient } from 'pg';

import type {
  CreateSecureExportCommand,
  SecureExportRepository,
} from '../../modules/reporting/application/manage-secure-export.js';
import {
  canonicalExport,
  exportChecksum,
  type ExportDataset,
  type ExportStatus,
  type approveMassExport,
} from '../../modules/reporting/domain/secure-export.js';

interface ExportRow {
  export_id: string;
  report_type: string;
  format: string;
  scope: 'SINGLE' | 'BULK';
  status: ExportStatus;
  filters: Record<string, string>;
  requester_id: string;
  approved_by: string | null;
  expired: boolean;
}

interface ExportEventRow {
  export_id: string;
  action: string;
  actor_id: string;
  resulting_status: ExportStatus;
}

interface GeneratedExportRow {
  export_id: string;
  generated_by: string;
  output_manifest: ExportDataset;
  output_checksum_sha256: string;
  expired: boolean;
}

export class PostgresSecureExportRepository implements SecureExportRepository {
  constructor(private readonly pool: Pick<Pool, 'connect'>) {}

  async create(command: CreateSecureExportCommand, status: ExportStatus) {
    const result = await this.withTransaction(async (client) => {
      await lockIdempotency(client, 'create', command.idempotencyKey);
      const replay = await client.query<ExportRow>(
        `SELECT export_id::text, report_type, format, scope, status, filters, requester_id,
                approved_by, expires_at <= clock_timestamp() AS expired
         FROM reporting.secure_export WHERE idempotency_key = $1`,
        [command.idempotencyKey],
      );
      if (replay.rows[0]) {
        assertCreateReplay(replay.rows[0], command);
        return replay.rows[0];
      }

      const inserted = await client.query<ExportRow>(
        `INSERT INTO reporting.secure_export
           (report_type, format, scope, status, filters, requester_id, idempotency_key)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
         RETURNING export_id::text, report_type, format, scope, status, filters, requester_id,
                   approved_by, false AS expired`,
        [command.reportType, command.format, command.scope, status,
          JSON.stringify(command.filters ?? {}), command.requesterId, command.idempotencyKey],
      );
      const created = inserted.rows[0];
      if (!created) throw new Error('Secure export creation returned no identifier');
      await insertAuditIntent(
        client, created.export_id, 'CREATE_SECURE_EXPORT', command.requesterId,
        'Secure export request created', created.status, command.correlationId,
      );
      return created;
    });
    // Creation idempotency replays the original command result. The aggregate
    // may since have moved to APPROVED or GENERATED, but that later state must
    // not change the response of the original creation command.
    return { exportId: result.export_id, status };
  }

  async approve(
    exportId: string,
    approverId: string,
    key: string,
    correlationId: string,
    decide: typeof approveMassExport,
  ) {
    return this.withTransaction(async (client) => {
      await lockIdempotency(client, 'approve', key);
      const replay = await findEventReplay(client, key);
      if (replay) {
        assertEventReplay(replay, exportId, 'REINFORCED_APPROVAL', approverId);
        return { status: replay.resulting_status };
      }

      const result = await client.query<ExportRow>(
        `SELECT export_id::text, report_type, format, scope, status, filters, requester_id,
                approved_by, expires_at <= clock_timestamp() AS expired
         FROM reporting.secure_export WHERE export_id = $1::uuid FOR UPDATE`,
        [exportId],
      );
      const current = result.rows[0];
      if (!current) throw new Error('Export not found');
      if (current.expired) throw new Error('Secure export request has expired');
      const next = decide(current.status, current.scope, current.requester_id, approverId);
      await client.query(
        `INSERT INTO reporting.secure_export_event
           (export_id, action, actor_id, resulting_status, idempotency_key)
         VALUES ($1::uuid, 'REINFORCED_APPROVAL', $2, $3, $4)`,
        [exportId, approverId, next, key],
      );
      await client.query(
        `UPDATE reporting.secure_export
         SET status = $2, approved_by = $3, approved_at = clock_timestamp()
         WHERE export_id = $1::uuid`,
        [exportId, next, approverId],
      );
      await insertAuditIntent(
        client, exportId, 'APPROVE_MASS_EXPORT', approverId,
        'Bulk secure export approved', next, correlationId,
      );
      return { status: next };
    });
  }

  async generate(
    exportId: string,
    actorId: string,
    dataset: ExportDataset,
    checksum: string,
    key: string,
    correlationId: string,
  ) {
    return this.withTransaction(async (client) => {
      await lockIdempotency(client, 'generate', key);
      const replay = await findGenerationReplay(client, key);
      if (replay) return validateGenerationReplay(replay, exportId, actorId, dataset, checksum);

      const result = await client.query<ExportRow>(
        `SELECT export_id::text, report_type, format, scope, status, filters, requester_id,
                approved_by, expires_at <= clock_timestamp() AS expired
         FROM reporting.secure_export WHERE export_id = $1::uuid FOR UPDATE`,
        [exportId],
      );
      const current = result.rows[0];
      if (!current) throw new Error('Export not found');
      if (current.expired) throw new Error('Secure export request has expired');
      if (current.status !== 'APPROVED') throw new Error('Export generation requires approval');
      if (current.requester_id !== actorId) throw new Error('Only the export requester can generate the artifact');
      if (current.scope === 'BULK' && (!current.approved_by || current.approved_by === actorId)) {
        throw new Error('Bulk export generation requires approval by a distinct checker');
      }
      const manifest = JSON.parse(canonicalExport(dataset)) as ExportDataset;
      if (exportChecksum(manifest) !== checksum) throw new Error('Export checksum does not match its manifest');

      await client.query(
        `UPDATE reporting.secure_export
         SET status = 'GENERATED', generated_by = $2, generated_at = clock_timestamp(),
             output_manifest = $3::jsonb, output_checksum_sha256 = $4,
             generation_idempotency_key = $5
         WHERE export_id = $1::uuid`,
        [exportId, actorId, JSON.stringify(manifest), checksum, key],
      );
      await client.query(
        `INSERT INTO reporting.secure_export_event
           (export_id, action, actor_id, resulting_status, idempotency_key)
         VALUES ($1::uuid, 'GENERATE', $2, 'GENERATED', $3)`,
        [exportId, actorId, key],
      );
      await insertAuditIntent(
        client, exportId, 'GENERATE_SECURE_EXPORT', actorId,
        'Secure export artifact generated', 'GENERATED', correlationId,
      );
      return { exportId, status: 'GENERATED' as const, checksumSha256: checksum };
    });
  }

  private async withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;
      const result = await work(client);
      await client.query('COMMIT');
      transactionStarted = false;
      return result;
    } catch (error) {
      if (transactionStarted) await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

async function lockIdempotency(client: PoolClient, operation: string, key: string): Promise<void> {
  await client.query(
    'SELECT pg_advisory_xact_lock(hashtext($1))',
    [`reporting.secure-export.${operation}.${key}`],
  );
}

async function findEventReplay(client: PoolClient, key: string): Promise<ExportEventRow | undefined> {
  const result = await client.query<ExportEventRow>(
    `SELECT export_id::text, action, actor_id, resulting_status
     FROM reporting.secure_export_event WHERE idempotency_key = $1`,
    [key],
  );
  return result.rows[0];
}

async function findGenerationReplay(client: PoolClient, key: string): Promise<GeneratedExportRow | undefined> {
  const result = await client.query<GeneratedExportRow>(
    `SELECT export_id::text, generated_by, output_manifest, output_checksum_sha256,
            expires_at <= clock_timestamp() AS expired
     FROM reporting.secure_export WHERE generation_idempotency_key = $1`,
    [key],
  );
  return result.rows[0];
}

function assertCreateReplay(row: ExportRow, command: CreateSecureExportCommand): void {
  if (row.expired) throw new Error('Secure export request has expired');
  if (row.report_type !== command.reportType || row.format !== command.format ||
    row.scope !== command.scope || row.requester_id !== command.requesterId ||
    stableJson(row.filters) !== stableJson(command.filters ?? {})) {
    throw new Error('Export replay payload differs');
  }
}

function assertEventReplay(
  row: ExportEventRow,
  exportId: string,
  action: string,
  actorId: string,
): void {
  if (row.export_id !== exportId || row.action !== action || row.actor_id !== actorId) {
    throw new Error('Export action replay payload differs');
  }
}

function validateGenerationReplay(
  row: GeneratedExportRow,
  exportId: string,
  actorId: string,
  dataset: ExportDataset,
  checksum: string,
) {
  if (row.expired) throw new Error('Secure export artifact has expired');
  const storedChecksum = exportChecksum(row.output_manifest);
  const requestedChecksum = exportChecksum(dataset);
  if (row.export_id !== exportId || row.generated_by !== actorId ||
    row.output_checksum_sha256 !== storedChecksum || checksum !== requestedChecksum ||
    checksum !== row.output_checksum_sha256) {
    throw new Error('Export generation replay payload or artifact integrity differs');
  }
  return { exportId: row.export_id, status: 'GENERATED' as const, checksumSha256: storedChecksum };
}

async function insertAuditIntent(
  client: PoolClient,
  exportId: string,
  action: string,
  actorId: string,
  justification: string,
  resultState: ExportStatus,
  correlationId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO integration.outbox_event (
       event_id, aggregate_type, aggregate_id, event_type, schema_version,
       correlation_id, payload, occurred_at
     ) VALUES (
       gen_random_uuid(), 'SecureExport', $1, 'pms.audit.workflow-action-recorded.v1', 1,
       $6::uuid, jsonb_build_object(
         'resourceType', 'SecureExport', 'resourceId', $1, 'action', $2,
         'actorId', $3, 'justification', $4, 'resultState', $5,
         'businessDate', current_date::text
       ), clock_timestamp()
     )`,
    [exportId, action, actorId, justification, resultState, correlationId],
  );
}

function stableJson(value: Readonly<Record<string, string>>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))));
}
