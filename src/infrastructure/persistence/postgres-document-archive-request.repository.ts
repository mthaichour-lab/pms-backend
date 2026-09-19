import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { DocumentArchiveRequestRepository, RequestDocumentArchiveCommand } from '../../modules/documents/application/request-document-archive.js';
import type { DocumentArchiveRequestView, DocumentArchiveStatus } from '../../modules/documents/domain/document-archive-request.js';

interface RequestRow {
  request_id: string; landing_object_key: string; business_type: string; business_id: string; classification: string;
  evidentiary: boolean; status: DocumentArchiveStatus; checksum_sha256: string | null; paperless_document_id: string | null;
  worm_object_key: string | null; created_at: Date; archived_at: Date | null;
}

export class PostgresDocumentArchiveRequestRepository implements DocumentArchiveRequestRepository {
  constructor(private readonly pool: Pick<Pool, 'connect' | 'query'>) {}

  async enqueueAtomically(command: RequestDocumentArchiveCommand): Promise<{ requestId: string; status: DocumentArchiveStatus }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query<{ request_id: string }>(
        `INSERT INTO document.archive_request(landing_object_key,business_type,business_id,classification,evidentiary,requested_by,idempotency_key)
         VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(idempotency_key) DO NOTHING RETURNING request_id::text`,
        [command.objectKey, command.businessType, command.businessId, command.classification, command.evidentiary, command.actorId, command.idempotencyKey],
      );
      let requestId = inserted.rows[0]?.request_id;
      let status: DocumentArchiveStatus = 'QUEUED';
      if (requestId) {
        await client.query(
          `INSERT INTO integration.outbox_event(event_id,aggregate_type,aggregate_id,event_type,schema_version,correlation_id,payload,occurred_at)
           VALUES(gen_random_uuid(),'Document', $1, 'pms.document.archive-requested.v1', 1, $8::uuid,
             jsonb_build_object('requestId',$1,'objectKey',$2,'businessType',$3,'businessId',$4,'classification',$5,'actorId',$6,'evidentiary',$7),clock_timestamp())`,
          [requestId, command.objectKey, command.businessType, command.businessId, command.classification, command.actorId, command.evidentiary, command.correlationId ?? randomUUID()],
        );
      } else {
        const replay = await client.query<RequestRow>(`SELECT * FROM document.archive_request WHERE idempotency_key=$1 FOR UPDATE`, [command.idempotencyKey]);
        const row = replay.rows[0];
        if (!row || row.landing_object_key !== command.objectKey || row.business_type !== command.businessType || row.business_id !== command.businessId || row.classification !== command.classification || row.evidentiary !== command.evidentiary) throw new Error('Document archive replay payload differs');
        requestId = row.request_id;
        status = row.status;
      }
      await client.query('COMMIT');
      return { requestId, status };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async find(requestId: string): Promise<DocumentArchiveRequestView | undefined> {
    const result = await this.pool.query<RequestRow>(`SELECT * FROM document.archive_request WHERE request_id=$1::uuid`, [requestId]);
    const row = result.rows[0];
    if (!row) return undefined;
    return { requestId: row.request_id, objectKey: row.landing_object_key, businessType: row.business_type, businessId: row.business_id, classification: row.classification, evidentiary: row.evidentiary, status: row.status, createdAt: row.created_at.toISOString(), ...(row.checksum_sha256 ? { checksumSha256: row.checksum_sha256 } : {}), ...(row.paperless_document_id ? { paperlessDocumentId: Number(row.paperless_document_id) } : {}), ...(row.worm_object_key ? { wormObjectKey: row.worm_object_key } : {}), ...(row.archived_at ? { archivedAt: row.archived_at.toISOString() } : {}) };
  }
}
