import { createHash } from 'node:crypto';

import type {
  AntivirusPort,
  ArchivedDocumentReference,
  DocumentContent,
  DocumentMetadata,
  DocumentReferenceRepository,
  PaperlessPort,
  WormArchivePort,
} from './document-ports.js';

export class UnsafeDocumentError extends Error {}
export class DocumentIntegrityError extends Error {}

export class ArchiveDocument {
  constructor(
    private readonly antivirus: AntivirusPort,
    private readonly paperless: PaperlessPort,
    private readonly worm: WormArchivePort,
    private readonly references: DocumentReferenceRepository,
  ) {}

  async execute(input: {
    content: DocumentContent;
    metadata: DocumentMetadata;
    idempotencyKey: string;
  }): Promise<ArchivedDocumentReference> {
    validateInput(input.content, input.idempotencyKey);
    const scan = await this.antivirus.scan(input.content);
    if (!scan.clean) {
      throw new UnsafeDocumentError(
        scan.signature ? `Malware detected: ${scan.signature}` : 'Document rejected by antivirus',
      );
    }

    const checksumSha256 = sha256(input.content.bytes);
    const paperless = await this.paperless.createDocument({
      ...input,
      checksumSha256,
    });
    if (paperless.checksumSha256 !== checksumSha256) {
      throw new DocumentIntegrityError('Paperless checksum differs from the uploaded original');
    }

    const worm = input.metadata.evidentiary
      ? await this.worm.preserve({
          content: input.content,
          idempotencyKey: input.idempotencyKey,
          manifest: {
            paperlessDocumentId: paperless.documentId,
            checksumSha256,
            businessType: input.metadata.businessType,
            businessId: input.metadata.businessId,
            classification: input.metadata.classification,
            evidentiary: true,
          },
        })
      : undefined;

    const reference: ArchivedDocumentReference = {
      paperlessDocumentId: paperless.documentId,
      businessType: input.metadata.businessType,
      businessId: input.metadata.businessId,
      classification: input.metadata.classification,
      originalFilename: input.content.filename,
      mediaType: input.content.mediaType,
      checksumSha256,
      wormObjectKey: worm?.objectKey,
      wormManifestChecksumSha256: worm?.manifestChecksumSha256,
      createdBy: input.metadata.actorId,
    };
    if (input.metadata.archiveRequestId) await this.references.save(reference, input.metadata.archiveRequestId);
    else await this.references.save(reference);
    return reference;
  }
}

function validateInput(content: DocumentContent, idempotencyKey: string): void {
  if (content.bytes.byteLength === 0) throw new TypeError('Document is empty');
  if (content.bytes.byteLength > 25 * 1024 * 1024) throw new RangeError('Document exceeds 25 MiB');
  if (
    content.filename.includes('/') ||
    content.filename.includes('\\') ||
    /[\u0000-\u001f]/.test(content.filename)
  ) {
    throw new TypeError('Unsafe document filename');
  }
  if (idempotencyKey.length < 16) throw new TypeError('Idempotency key is too short');
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
