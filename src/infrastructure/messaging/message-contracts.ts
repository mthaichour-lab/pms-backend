export interface OutboxMessage {
  eventId: string;
  eventType: string;
  schemaVersion: number;
  aggregateType: string;
  aggregateId: string;
  correlationId: string;
  causationId?: string;
  occurredAt: string;
  payload: Readonly<Record<string, unknown>>;
}

export interface OutboxRecord extends OutboxMessage {
  availableAt: string;
  createdAt: string;
  publishAttempts: number;
}

export interface OutboxRepository {
  claimPending(limit: number, now: string): Promise<readonly OutboxRecord[]>;
  markPublished(eventId: string, publishedAt: string): Promise<void>;
  markFailed(eventId: string, nextAttemptAt: string, reason: string): Promise<void>;
}

export interface EventPublisher {
  publish(message: OutboxMessage): Promise<void>;
}

export interface InboxRepository {
  begin(consumerName: string, message: OutboxMessage): Promise<boolean>;
  complete(consumerName: string, messageId: string, checksum?: string): Promise<void>;
  abandon(consumerName: string, messageId: string): Promise<void>;
}
