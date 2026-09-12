import type {
  ArchivedDocumentReference,
  DocumentReferenceRepository,
} from '../../modules/documents/application/document-ports.js';
import type { SqlClient } from './postgres-client.js';

export class PostgresDocumentReferenceRepository implements DocumentReferenceRepository {
  constructor(private readonly database: SqlClient) {}

  async save(reference: ArchivedDocumentReference, archiveRequestId?: string): Promise<void> {
    if (archiveRequestId) {
      await this.database.query(
        `WITH inserted AS (
           INSERT INTO document.document_reference
             (paperless_document_id,business_type,business_id,classification,original_filename,media_type,checksum_sha256,worm_object_key,worm_manifest_checksum,created_by)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (business_type,business_id,checksum_sha256) DO NOTHING
           RETURNING document_reference_id
         ), archived AS (
           SELECT document_reference_id FROM inserted
           UNION ALL
           SELECT document_reference_id FROM document.document_reference WHERE business_type=$2 AND business_id=$3 AND checksum_sha256=$7
           LIMIT 1
         )
         UPDATE document.archive_request request
         SET status='ARCHIVED', checksum_sha256=$7, paperless_document_id=$1, worm_object_key=$8, archived_at=clock_timestamp()
         FROM archived WHERE request.request_id=$11::uuid AND request.status='QUEUED'`,
        [reference.paperlessDocumentId, reference.businessType, reference.businessId, reference.classification, reference.originalFilename, reference.mediaType, reference.checksumSha256, reference.wormObjectKey ?? null, reference.wormManifestChecksumSha256 ?? null, reference.createdBy, archiveRequestId],
      );
      return;
    }
    await this.database.query(
      `INSERT INTO document.document_reference
         (paperless_document_id, business_type, business_id, classification,
          original_filename, media_type, checksum_sha256, worm_object_key,
          worm_manifest_checksum, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (paperless_document_id) DO NOTHING`,
      [
        reference.paperlessDocumentId,
        reference.businessType,
        reference.businessId,
        reference.classification,
        reference.originalFilename,
        reference.mediaType,
        reference.checksumSha256,
        reference.wormObjectKey ?? null,
        reference.wormManifestChecksumSha256 ?? null,
        reference.createdBy,
      ],
    );
  }
}
