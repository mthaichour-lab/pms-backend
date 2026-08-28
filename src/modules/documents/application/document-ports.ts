export interface DocumentContent {
  bytes: Uint8Array;
  filename: string;
  mediaType: string;
}

export interface DocumentMetadata {
  businessType: string;
  businessId: string;
  classification: string;
  actorId: string;
  evidentiary: boolean;
}

export interface AntivirusPort {
  scan(content: DocumentContent): Promise<{ clean: boolean; signature?: string }>;
}

export interface PaperlessPort {
  createDocument(input: {
    content: DocumentContent;
    metadata: DocumentMetadata;
    checksumSha256: string;
    idempotencyKey: string;
  }): Promise<{ documentId: number; checksumSha256: string }>;
}

export interface WormArchivePort {
  preserve(input: {
    content: DocumentContent;
    manifest: Readonly<Record<string, string | number | boolean>>;
    idempotencyKey: string;
  }): Promise<{ objectKey: string; manifestChecksumSha256: string }>;
}

export interface DocumentReferenceRepository {
  save(reference: ArchivedDocumentReference): Promise<void>;
}

export interface ArchivedDocumentReference {
  paperlessDocumentId: number;
  businessType: string;
  businessId: string;
  classification: string;
  originalFilename: string;
  mediaType: string;
  checksumSha256: string;
  wormObjectKey?: string;
  wormManifestChecksumSha256?: string;
  createdBy: string;
}
