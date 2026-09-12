import { describe, expect, it, vi } from 'vitest';
import { RequestDocumentArchive, type DocumentArchiveRequestRepository } from '../../../src/modules/documents/application/request-document-archive.js';

const command = { objectKey: 'landing/contracts/proof.pdf', businessType: 'SHARIA_DECISION', businessId: 'decision-1', classification: 'CONFIDENTIAL', evidentiary: true, actorId: 'auditor-1', idempotencyKey: 'archive-request-0001' };
describe('RequestDocumentArchive', () => {
  it('validates then enqueues the asynchronous archive once', async () => {
    const repository: DocumentArchiveRequestRepository = { enqueueAtomically: vi.fn().mockResolvedValue({ requestId: '00000000-0000-4000-8000-000000000001', status: 'QUEUED' }), find: vi.fn() };
    await expect(new RequestDocumentArchive(repository).enqueue(command)).resolves.toMatchObject({ status: 'QUEUED' });
    expect(repository.enqueueAtomically).toHaveBeenCalledWith(command);
  });
  it('rejects traversal in the landing object key', () => {
    const repository = { enqueueAtomically: vi.fn(), find: vi.fn() } as DocumentArchiveRequestRepository;
    expect(() => new RequestDocumentArchive(repository).enqueue({ ...command, objectKey: 'landing/../secret' })).toThrow('landing object key');
  });
});
