import type { QueryResultRow } from 'pg';

import type {
  OutboxRecord,
  OutboxRepository,
} from '../messaging/message-contracts.js';
import type { SqlClient } from './postgres-client.js';

interface OutboxRow extends QueryResultRow {
  event_id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  schema_version: number;
  correlation_id: string;
  causation_id: string | null;
  payload: Record<string, unknown>;
  occurred_at: Date;
  available_at: Date;
  created_at: Date;
  publish_attempts: number;
}

export class PostgresOutboxRepository implements OutboxRepository {
  constructor(
    private readonly database: SqlClient,
    private readonly workerId: string,
    private readonly leaseSeconds = 60,
  ) {}

  async claimPending(limit: number, now: string): Promise<readonly OutboxRecord[]> {
    const result = await this.database.query<OutboxRow>(
      `WITH candidates AS (
         SELECT event_id
         FROM integration.outbox_event
         WHERE published_at IS NULL
           AND available_at <= $1::timestamptz
           AND (locked_until IS NULL OR locked_until < $1::timestamptz)
         ORDER BY available_at, created_at
         FOR UPDATE SKIP LOCKED
         LIMIT $2
       )
       UPDATE integration.outbox_event event
       SET locked_by = $3,
           locked_until = $1::timestamptz + make_interval(secs => $4)
       FROM candidates
       WHERE event.event_id = candidates.event_id
       RETURNING event.*`,
      [now, limit, this.workerId, this.leaseSeconds],
    );
    return result.rows.map(mapOutboxRecord);
  }

  async markPublished(eventId: string, publishedAt: string): Promise<void> {
    await this.database.query(
      `UPDATE integration.outbox_event
       SET published_at = $2::timestamptz,
           locked_by = NULL,
           locked_until = NULL,
           last_error = NULL
       WHERE event_id = $1::uuid AND locked_by = $3`,
      [eventId, publishedAt, this.workerId],
    );
  }

  async markFailed(eventId: string, nextAttemptAt: string, reason: string): Promise<void> {
    await this.database.query(
      `UPDATE integration.outbox_event
       SET available_at = $2::timestamptz,
           publish_attempts = publish_attempts + 1,
           last_error = $3,
           locked_by = NULL,
           locked_until = NULL
       WHERE event_id = $1::uuid AND locked_by = $4`,
      [eventId, nextAttemptAt, reason, this.workerId],
    );
  }
}

function mapOutboxRecord(row: OutboxRow): OutboxRecord {
  return {
    eventId: row.event_id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    eventType: row.event_type,
    schemaVersion: row.schema_version,
    correlationId: row.correlation_id,
    causationId: row.causation_id ?? undefined,
    payload: row.payload,
    occurredAt: row.occurred_at.toISOString(),
    availableAt: row.available_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    publishAttempts: row.publish_attempts,
  };
}
