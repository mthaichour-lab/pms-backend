import type {
  ArchivedDocumentReference,
  DocumentReferenceRepository,
} from '../../modules/documents/application/document-ports.js';
import type { SqlClient } from './postgres-client.js';

export class PostgresDocumentReferenceRepository implements DocumentReferenceRepository {
  constructor(private readonly database: SqlClient) {}

  async save(reference: ArchivedDocumentReference): Promise<void> {
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
