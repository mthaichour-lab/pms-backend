import type {
  EventPublisher,
  OutboxRecord,
  OutboxRepository,
} from './message-contracts.js';

export interface RelayResult {
  published: readonly string[];
  failed: readonly string[];
}

export class OutboxRelay {
  constructor(
    private readonly repository: OutboxRepository,
    private readonly publisher: EventPublisher,
    private readonly retryBaseSeconds = 5,
  ) {}

  async runBatch(limit: number, now: string): Promise<RelayResult> {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError('Outbox batch limit must be a positive integer');
    }
    const records = await this.repository.claimPending(limit, now);
    const published: string[] = [];
    const failed: string[] = [];

    for (const record of records) {
      try {
        await this.publisher.publish(record);
        await this.repository.markPublished(record.eventId, now);
        published.push(record.eventId);
      } catch (error) {
        const nextAttemptAt = retryAt(now, record, this.retryBaseSeconds);
        await this.repository.markFailed(
          record.eventId,
          nextAttemptAt,
          safeErrorMessage(error),
        );
        failed.push(record.eventId);
      }
    }

    return { published, failed };
  }
}

function retryAt(now: string, record: OutboxRecord, baseSeconds: number): string {
  const delaySeconds = Math.min(
    baseSeconds * 2 ** Math.min(record.publishAttempts, 10),
    3600,
  );
  return new Date(Date.parse(now) + delaySeconds * 1000).toISOString();
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown publish error';
  return message.slice(0, 500);
}
