import { validateDocumentArchiveRequest, type DocumentArchiveRequestDraft, type DocumentArchiveRequestView, type DocumentArchiveStatus } from '../domain/document-archive-request.js';

export interface RequestDocumentArchiveCommand extends DocumentArchiveRequestDraft {
  actorId: string;
  idempotencyKey: string;
  correlationId?: string;
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
    if (!/^[A-Za-z0-9._:-]{16,128}$/.test(command.idempotencyKey.trim())) throw new TypeError('Idempotency key must contain between 16 and 128 safe characters');
    if (command.correlationId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(command.correlationId.trim())) throw new TypeError('Document archive correlation identifier must be a UUID');
    return this.repository.enqueueAtomically({ ...command, actorId: command.actorId.trim(), idempotencyKey: command.idempotencyKey.trim(), ...(command.correlationId ? { correlationId: command.correlationId.trim().toLowerCase() } : {}) });
  }

  async get(requestId: string): Promise<DocumentArchiveRequestView> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new TypeError('Invalid document archive request identifier');
    const request = await this.repository.find(requestId);
    if (!request) throw new Error('Document archive request not found');
    return request;
  }
}
