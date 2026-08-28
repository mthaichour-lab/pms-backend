import type {
  InboxRepository,
  OutboxMessage,
} from '../messaging/message-contracts.js';
import type { SqlClient } from './postgres-client.js';

export class PostgresInboxRepository implements InboxRepository {
  constructor(private readonly database: SqlClient) {}

  async begin(consumerName: string, message: OutboxMessage): Promise<boolean> {
    const result = await this.database.query(
      `INSERT INTO integration.inbox_message
         (consumer_name, message_id, event_type, correlation_id,
          processing_started_at, processing_attempts)
       VALUES ($1, $2::uuid, $3, $4::uuid, clock_timestamp(), 1)
       ON CONFLICT (consumer_name, message_id) DO UPDATE
       SET processing_started_at = clock_timestamp(),
           processing_attempts = integration.inbox_message.processing_attempts + 1
       WHERE integration.inbox_message.processed_at IS NULL
         AND integration.inbox_message.processing_started_at < clock_timestamp() - interval '5 minutes'`,
      [consumerName, message.eventId, message.eventType, message.correlationId],
    );
    return result.rowCount === 1;
  }

  async complete(consumerName: string, messageId: string, checksum?: string): Promise<void> {
    await this.database.query(
      `UPDATE integration.inbox_message
       SET processed_at = clock_timestamp(), result_checksum = $3
       WHERE consumer_name = $1 AND message_id = $2::uuid`,
      [consumerName, messageId, checksum ?? null],
    );
  }

  async abandon(consumerName: string, messageId: string): Promise<void> {
    await this.database.query(
      `DELETE FROM integration.inbox_message
       WHERE consumer_name = $1 AND message_id = $2::uuid AND processed_at IS NULL`,
      [consumerName, messageId],
    );
  }
}
