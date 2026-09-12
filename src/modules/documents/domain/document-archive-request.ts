export type DocumentArchiveStatus = 'QUEUED' | 'ARCHIVED';

export interface DocumentArchiveRequestDraft {
  objectKey: string;
  businessType: string;
  businessId: string;
  classification: string;
  evidentiary: boolean;
}

export interface DocumentArchiveRequestView extends DocumentArchiveRequestDraft {
  requestId: string;
  status: DocumentArchiveStatus;
  checksumSha256?: string;
  paperlessDocumentId?: number;
  wormObjectKey?: string;
  createdAt: string;
  archivedAt?: string;
}

export function validateDocumentArchiveRequest(input: DocumentArchiveRequestDraft): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{2,511}$/.test(input.objectKey) || input.objectKey.includes('..')) throw new TypeError('Invalid landing object key');
  if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(input.businessType)) throw new TypeError('Invalid document business type');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/.test(input.businessId)) throw new TypeError('Invalid document business identifier');
  if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(input.classification)) throw new TypeError('Invalid document classification');
}
