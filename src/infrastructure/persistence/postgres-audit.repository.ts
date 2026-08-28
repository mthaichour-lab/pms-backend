import type { Pool, PoolClient } from 'pg';

import {
  createSignedAuditEvent,
  type AuditEventDraft,
  type AuditSigner,
  type SignedAuditEvent,
} from '../../modules/audit/domain/audit-chain.js';

export class PostgresAuditRepository {
  constructor(
    private readonly pool: Pick<Pool, 'connect'>,
    private readonly signer: AuditSigner,
  ) {}

  async append(draft: AuditEventDraft): Promise<SignedAuditEvent> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('pms.audit.chain'))");
      const previous = await client.query<{ event_hash: string }>(
        'SELECT event_hash FROM audit.event ORDER BY created_at DESC, audit_event_id DESC LIMIT 1',
      );
      const event = await createSignedAuditEvent(
        draft,
        previous.rows[0]?.event_hash,
        this.signer,
      );
      await insertAuditEvent(client, event);
      await client.query('COMMIT');
      return event;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

async function insertAuditEvent(client: PoolClient, event: SignedAuditEvent): Promise<void> {
  await client.query(
    `INSERT INTO audit.event (
       audit_event_id, previous_hash, event_hash, signing_key_id, signature_base64,
       correlation_id, actor_id, technical_identity, session_id, action,
       resource_type, resource_id, outcome, business_date, occurred_at,
       source_application, source_address, justification, run_id, batch_id,
       document_reference_id, authorized_changes
     ) VALUES (
       $1::uuid, $2, $3, $4, $5, $6::uuid, $7, $8, $9, $10,
       $11, $12, $13, $14::date, $15::timestamptz, $16, $17::inet, $18,
       $19::uuid, $20::uuid, $21::uuid, $22::jsonb
     )`,
    [
      event.auditEventId,
      event.previousHash ?? null,
      event.eventHash,
      event.signingKeyId,
      event.signatureBase64,
      event.correlationId,
      event.actorId,
      event.technicalIdentity,
      event.sessionId ?? null,
      event.action,
      event.resourceType,
      event.resourceId,
      event.outcome,
      event.businessDate,
      event.occurredAt,
      event.sourceApplication,
      event.sourceAddress ?? null,
      event.justification ?? null,
      event.runId ?? null,
      event.batchId ?? null,
      event.documentReferenceId ?? null,
      event.authorizedChanges ? JSON.stringify(event.authorizedChanges) : null,
    ],
  );
}
