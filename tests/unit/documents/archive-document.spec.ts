import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import {
  ArchiveDocument,
  DocumentIntegrityError,
  UnsafeDocumentError,
} from '../../../src/modules/documents/application/archive-document.js';
import type {
  AntivirusPort,
  DocumentReferenceRepository,
  PaperlessPort,
  WormArchivePort,
} from '../../../src/modules/documents/application/document-ports.js';

const bytes = new TextEncoder().encode('signed sharia decision');
const checksum = createHash('sha256').update(bytes).digest('hex');
const input = {
  content: { bytes, filename: 'decision.pdf', mediaType: 'application/pdf' },
  metadata: {
    businessType: 'SHARIA_DECISION',
    businessId: 'decision-1',
    classification: 'CONFIDENTIAL',
    actorId: 'user-1',
    evidentiary: true,
  },
  idempotencyKey: 'document-upload-0001',
};

describe('ArchiveDocument', () => {
  it('scans, verifies Paperless and preserves evidentiary originals in WORM', async () => {
    const ports = cleanPorts();
    const useCase = new ArchiveDocument(...ports.arguments);

    const result = await useCase.execute(input);

    expect(result.checksumSha256).toBe(checksum);
    expect(result.wormObjectKey).toBe('worm/decision-1');
    expect(ports.worm.preserve).toHaveBeenCalledOnce();
    expect(ports.references.save).toHaveBeenCalledWith(result);
  });

  it('never sends an infected file to Paperless or WORM', async () => {
    const ports = cleanPorts();
    ports.antivirus.scan.mockResolvedValue({ clean: false, signature: 'EICAR' });
    const useCase = new ArchiveDocument(...ports.arguments);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(UnsafeDocumentError);
    expect(ports.paperless.createDocument).not.toHaveBeenCalled();
    expect(ports.worm.preserve).not.toHaveBeenCalled();
  });

  it('rejects a checksum mismatch before persisting the reference', async () => {
    const ports = cleanPorts();
    ports.paperless.createDocument.mockResolvedValue({ documentId: 42, checksumSha256: '0'.repeat(64) });
    const useCase = new ArchiveDocument(...ports.arguments);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(DocumentIntegrityError);
    expect(ports.references.save).not.toHaveBeenCalled();
  });
});

function cleanPorts() {
  const antivirus = { scan: vi.fn<AntivirusPort['scan']>().mockResolvedValue({ clean: true }) };
  const paperless = {
    createDocument: vi.fn<PaperlessPort['createDocument']>().mockResolvedValue({ documentId: 42, checksumSha256: checksum }),
  };
  const worm = {
    preserve: vi.fn<WormArchivePort['preserve']>().mockResolvedValue({ objectKey: 'worm/decision-1', manifestChecksumSha256: 'a'.repeat(64) }),
  };
  const references = { save: vi.fn<DocumentReferenceRepository['save']>().mockResolvedValue(undefined) };
  return { antivirus, paperless, worm, references, arguments: [antivirus, paperless, worm, references] as const };
}
