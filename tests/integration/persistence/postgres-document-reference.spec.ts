import { describe, expect, it, vi } from 'vitest';

import { PostgresDocumentReferenceRepository } from '../../../src/infrastructure/persistence/postgres-document-reference.repository.js';
import type { SqlClient } from '../../../src/infrastructure/persistence/postgres-client.js';

describe('PostgresDocumentReferenceRepository', () => {
  it('persists the immutable archive references with parameterized SQL', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1 });
    const repository = new PostgresDocumentReferenceRepository({ query } as unknown as SqlClient);
    await repository.save({
      paperlessDocumentId: 42,
      businessType: 'loan', businessId: 'LN-7', classification: 'confidential',
      originalFilename: 'contract.pdf', mediaType: 'application/pdf',
      checksumSha256: 'a'.repeat(64), wormObjectKey: 'worm/42',
      wormManifestChecksumSha256: 'b'.repeat(64), createdBy: 'user-1',
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO document.document_reference'), [
      42, 'loan', 'LN-7', 'confidential', 'contract.pdf', 'application/pdf',
      'a'.repeat(64), 'worm/42', 'b'.repeat(64), 'user-1',
    ]);
  });
});
