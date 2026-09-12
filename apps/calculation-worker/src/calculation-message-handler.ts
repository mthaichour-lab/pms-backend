import { IdempotentConsumer } from '../../../src/infrastructure/messaging/idempotent-consumer.js';
import type { InboxRepository, OutboxMessage } from '../../../src/infrastructure/messaging/message-contracts.js';
import { ExecuteProfitCalculation } from '../../../src/modules/profit-calculation/application/execute-profit-calculation.js';

export class CalculationMessageHandler {
  private readonly consumer: IdempotentConsumer;

  constructor(inbox: InboxRepository, private readonly executeCalculation: ExecuteProfitCalculation) {
    this.consumer = new IdempotentConsumer('calculation-worker', inbox);
  }

  handle(message: OutboxMessage): Promise<'PROCESSED' | 'DUPLICATE'> {
    return this.consumer.handle(message, async () => {
      const result = await this.executeCalculation.execute({
        runId: stringField(message.payload, 'runId'),
        poolId: stringField(message.payload, 'poolId'),
        businessDate: stringField(message.payload, 'businessDate'),
        rulesVersion: stringField(message.payload, 'rulesVersion'),
        requestedBy: stringField(message.payload, 'requestedBy'),
        correlationId: message.correlationId,
        runKind: optionalRunKind(message.payload.runKind),
      });
      return result.outputChecksumSha256;
    });
  }
}

function optionalRunKind(value: unknown): 'PARALLEL' | 'PRODUCTION' | undefined {
  if (value === undefined) return undefined;
  if (value !== 'PARALLEL' && value !== 'PRODUCTION') throw new TypeError('Invalid calculation event field: runKind');
  return value;
}

function stringField(payload: Readonly<Record<string, unknown>>, name: string): string {
  const value = payload[name];
  if (typeof value !== 'string' || !value) throw new TypeError(`Invalid calculation event field: ${name}`);
  return value;
}
