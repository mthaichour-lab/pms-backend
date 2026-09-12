import { IdempotentConsumer } from '../../../src/infrastructure/messaging/idempotent-consumer.js';
import type {
  InboxRepository,
  OutboxMessage,
} from '../../../src/infrastructure/messaging/message-contracts.js';
import { ArchiveDocument } from '../../../src/modules/documents/application/archive-document.js';
import type { DocumentContent } from '../../../src/modules/documents/application/document-ports.js';

export interface LandingStoragePort {
  load(objectKey: string): Promise<DocumentContent>;
}

export class DocumentMessageHandler {
  private readonly consumer: IdempotentConsumer;

  constructor(
    inbox: InboxRepository,
    private readonly landingStorage: LandingStoragePort,
    private readonly archiveDocument: ArchiveDocument,
  ) {
    this.consumer = new IdempotentConsumer('document-worker', inbox);
  }

  handle(message: OutboxMessage): Promise<'PROCESSED' | 'DUPLICATE'> {
    return this.consumer.handle(message, async () => {
      const payload = archivePayload(message.payload);
      const content = await this.landingStorage.load(payload.objectKey);
      const reference = await this.archiveDocument.execute({
        content,
        idempotencyKey: message.eventId,
        metadata: {
          businessType: payload.businessType,
          businessId: payload.businessId,
          classification: payload.classification,
          actorId: payload.actorId,
          evidentiary: payload.evidentiary,
          archiveRequestId: payload.requestId,
        },
      });
      return reference.checksumSha256;
    });
  }
}

function archivePayload(payload: Readonly<Record<string, unknown>>) {
  const requiredStrings = [
    'requestId',
    'objectKey',
    'businessType',
    'businessId',
    'classification',
    'actorId',
  ] as const;
  for (const field of requiredStrings) {
    if (typeof payload[field] !== 'string' || payload[field].length === 0) {
      throw new TypeError(`Invalid document event field: ${field}`);
    }
  }
  if (typeof payload['evidentiary'] !== 'boolean') {
    throw new TypeError('Invalid document event field: evidentiary');
  }
  return {
    requestId: payload['requestId'] as string,
    objectKey: payload['objectKey'] as string,
    businessType: payload['businessType'] as string,
    businessId: payload['businessId'] as string,
    classification: payload['classification'] as string,
    actorId: payload['actorId'] as string,
    evidentiary: payload['evidentiary'] as boolean,
  };
}
