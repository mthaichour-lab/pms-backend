import { validateDocumentArchiveRequest, type DocumentArchiveRequestDraft, type DocumentArchiveRequestView, type DocumentArchiveStatus } from '../domain/document-archive-request.js';

export interface RequestDocumentArchiveCommand extends DocumentArchiveRequestDraft {
  actorId: string;
  idempotencyKey: string;
}

export interface DocumentArchiveRequestRepository {
  enqueueAtomically(command: RequestDocumentArchiveCommand): Promise<{ requestId: string; status: DocumentArchiveStatus }>;
  find(requestId: string): Promise<DocumentArchiveRequestView | undefined>;
}

export class RequestDocumentArchive {
  constructor(private readonly repository: DocumentArchiveRequestRepository) {}

  enqueue(command: RequestDocumentArchiveCommand) {
    validateDocumentArchiveRequest(command);
    if (!command.actorId.trim()) throw new TypeError('Document archive actor is required');
    if (command.idempotencyKey.length < 16) throw new TypeError('Idempotency key must contain at least 16 characters');
    return this.repository.enqueueAtomically(command);
  }

  async get(requestId: string): Promise<DocumentArchiveRequestView> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new TypeError('Invalid document archive request identifier');
    const request = await this.repository.find(requestId);
    if (!request) throw new Error('Document archive request not found');
    return request;
  }
}
