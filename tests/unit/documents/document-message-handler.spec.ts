import { describe, expect, it, vi } from 'vitest';

import { DocumentMessageHandler } from '../../../apps/document-worker/src/document-message-handler.js';
import type { InboxRepository } from '../../../src/infrastructure/messaging/message-contracts.js';
import type { ArchiveDocument } from '../../../src/modules/documents/application/archive-document.js';

describe('DocumentMessageHandler', () => {
  it('loads content from landing and completes Inbox with the archived checksum', async () => {
    const inbox: InboxRepository = {
      begin: vi.fn().mockResolvedValue(true),
      complete: vi.fn().mockResolvedValue(undefined),
      abandon: vi.fn().mockResolvedValue(undefined),
    };
    const content = {
      bytes: new Uint8Array([1, 2, 3]),
      filename: 'proof.pdf',
      mediaType: 'application/pdf',
    };
    const landingStorage = { load: vi.fn().mockResolvedValue(content) };
    const archiveDocument = {
      execute: vi.fn().mockResolvedValue({ checksumSha256: 'a'.repeat(64) }),
    } as unknown as ArchiveDocument;
    const handler = new DocumentMessageHandler(inbox, landingStorage, archiveDocument);

    await expect(
      handler.handle({
        eventId: '8e217c4d-a299-4387-a8c1-8f19944c2f1d',
        eventType: 'pms.document.archive-requested.v1',
        schemaVersion: 1,
        aggregateType: 'Document',
        aggregateId: 'proof-1',
        correlationId: 'ab18231e-0567-4c48-9879-a8b6c3928494',
        occurredAt: '2026-08-28T00:00:00.000Z',
        payload: {
          objectKey: 'landing/proof-1',
          requestId: '00000000-0000-4000-8000-000000000001',
          businessType: 'SHARIA_DECISION',
          businessId: 'decision-1',
          classification: 'CONFIDENTIAL',
          actorId: 'user-1',
          evidentiary: true,
        },
      }),
    ).resolves.toBe('PROCESSED');

    expect(landingStorage.load).toHaveBeenCalledWith('landing/proof-1');
    expect(archiveDocument.execute).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ archiveRequestId: '00000000-0000-4000-8000-000000000001' }) }));
    expect(inbox.complete).toHaveBeenCalledWith(
      'document-worker',
      '8e217c4d-a299-4387-a8c1-8f19944c2f1d',
      'a'.repeat(64),
    );
  });
});
