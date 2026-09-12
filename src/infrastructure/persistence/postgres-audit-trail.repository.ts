import type { QueryResultRow } from 'pg';
import type { AuditTrailFilters, AuditTrailRepository, AuditTrailWindow } from '../../modules/audit/application/query-audit-trail.js';
import type { SignedAuditEvent } from '../../modules/audit/domain/audit-chain.js';
import type { SqlClient } from './postgres-client.js';

interface AuditRow extends QueryResultRow {
  audit_event_id: string; previous_hash: string | null; event_hash: string; signing_key_id: string; signature_base64: string;
  correlation_id: string; actor_id: string; technical_identity: string; session_id: string | null; action: string;
  resource_type: string; resource_id: string; outcome: SignedAuditEvent['outcome']; business_date: string; occurred_at: Date;
  source_application: string; source_address: string | null; justification: string | null; run_id: string | null; batch_id: string | null;
  document_reference_id: string | null; authorized_changes: Record<string, unknown> | null;
  matches_filter: boolean; predecessor_exists: boolean;
}

export class PostgresAuditTrailRepository implements AuditTrailRepository {
  constructor(private readonly database: SqlClient) {}
  async latestWindow(scanLimit: number, filters: AuditTrailFilters): Promise<AuditTrailWindow> {
    const conditions: string[] = [];
    const values: unknown[] = [scanLimit];
    const add = (column: string, cast: string, value: string | undefined, operator = '=') => {
      if (value === undefined) return;
      values.push(value); conditions.push(`${column} ${operator} $${values.length}${cast}`);
    };
    add('action', '', filters.action);
    add('resource_type', '', filters.resourceType);
    add('outcome', '', filters.outcome);
    add('correlation_id', '::uuid', filters.correlationId);
    add('business_date', '::date', filters.businessDateFrom, '>=');
    add('business_date', '::date', filters.businessDateTo, '<=');
    const matchesFilter = conditions.length ? conditions.join(' AND ') : 'TRUE';
    const result = await this.database.query<AuditRow>(
      `SELECT audit_event_id::text,previous_hash,event_hash,signing_key_id,signature_base64,correlation_id::text,actor_id,technical_identity,session_id,action,resource_type,resource_id,outcome,business_date::text,occurred_at,source_application,source_address::text,justification,run_id::text,batch_id::text,document_reference_id::text,authorized_changes,
         (${matchesFilter}) AS matches_filter,
         (previous_hash IS NOT DISTINCT FROM (
           SELECT predecessor.event_hash FROM audit.event predecessor
           WHERE (predecessor.created_at, predecessor.audit_event_id) < (latest.created_at, latest.audit_event_id)
           ORDER BY predecessor.created_at DESC, predecessor.audit_event_id DESC LIMIT 1
         )) AS predecessor_exists
       FROM (SELECT * FROM audit.event ORDER BY created_at DESC,audit_event_id DESC LIMIT $1) latest
       ORDER BY created_at ASC,audit_event_id ASC`,
      values,
    );
    return {
      events: result.rows.map((row) => ({ auditEventId: row.audit_event_id, ...(row.previous_hash ? { previousHash: row.previous_hash } : {}), eventHash: row.event_hash, signingKeyId: row.signing_key_id, signatureBase64: row.signature_base64, correlationId: row.correlation_id, actorId: row.actor_id, technicalIdentity: row.technical_identity, ...(row.session_id ? { sessionId: row.session_id } : {}), action: row.action, resourceType: row.resource_type, resourceId: row.resource_id, outcome: row.outcome, businessDate: row.business_date, occurredAt: row.occurred_at.toISOString(), sourceApplication: row.source_application, ...(row.source_address ? { sourceAddress: row.source_address } : {}), ...(row.justification ? { justification: row.justification } : {}), ...(row.run_id ? { runId: row.run_id } : {}), ...(row.batch_id ? { batchId: row.batch_id } : {}), ...(row.document_reference_id ? { documentReferenceId: row.document_reference_id } : {}), ...(row.authorized_changes ? { authorizedChanges: row.authorized_changes } : {}) })),
      matches: result.rows.map((row) => row.matches_filter),
      predecessorExists: result.rows.map((row) => row.predecessor_exists),
    };
  }
}
