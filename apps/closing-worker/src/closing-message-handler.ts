import { IdempotentConsumer } from '../../../src/infrastructure/messaging/idempotent-consumer.js';
import type { InboxRepository, OutboxMessage } from '../../../src/infrastructure/messaging/message-contracts.js';
import { EvaluateClosingRequest } from '../../../src/modules/closing-workflow/application/evaluate-closing-request.js';

export class ClosingMessageHandler {
  private readonly consumer: IdempotentConsumer;

  constructor(inbox: InboxRepository, private readonly evaluate: EvaluateClosingRequest) {
    this.consumer = new IdempotentConsumer('closing-worker', inbox);
  }

  handle(message: OutboxMessage): Promise<'PROCESSED' | 'DUPLICATE'> {
    return this.consumer.handle(message, async () => {
      const result = await this.evaluate.execute({
        closingId: stringField(message.payload, 'closingId'),
        businessDate: stringField(message.payload, 'businessDate'),
        requestedBy: stringField(message.payload, 'requestedBy'),
        correlationId: message.correlationId,
      });
      return result.state;
    });
  }
}

function stringField(payload: Readonly<Record<string, unknown>>, name: string): string {
  const value = payload[name];
  if (typeof value !== 'string' || !value) throw new TypeError(`Invalid closing event field: ${name}`);
  return value;
}
