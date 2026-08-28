import { connect, type ChannelModel, type ConfirmChannel, type Message } from 'amqplib';

import type {
  EventPublisher,
  OutboxMessage,
} from './message-contracts.js';

export interface RabbitMqPublisherOptions {
  url: string;
  exchange: string;
  exchangeType?: 'topic' | 'direct';
}

interface PendingPublish {
  resolve: () => void;
  reject: (error: Error) => void;
}

export class RabbitMqEventPublisher implements EventPublisher {
  private readonly pending = new Map<string, PendingPublish>();

  private constructor(
    private readonly connection: ChannelModel,
    private readonly channel: ConfirmChannel,
    private readonly exchange: string,
  ) {
    channel.on('return', (message) => this.rejectReturnedMessage(message));
    channel.on('error', (error) => this.rejectAll(error));
  }

  static async connect(options: RabbitMqPublisherOptions): Promise<RabbitMqEventPublisher> {
    const connectionUrl = new URL(options.url);
    connectionUrl.searchParams.set('heartbeat', '30');
    const connection = await connect(connectionUrl.toString());
    const channel = await connection.createConfirmChannel();
    await channel.assertExchange(options.exchange, options.exchangeType ?? 'topic', {
      durable: true,
      autoDelete: false,
    });
    return new RabbitMqEventPublisher(connection, channel, options.exchange);
  }

  publish(message: OutboxMessage): Promise<void> {
    if (this.pending.has(message.eventId)) {
      return Promise.reject(new Error(`Event is already awaiting confirmation: ${message.eventId}`));
    }

    return new Promise((resolve, reject) => {
      this.pending.set(message.eventId, { resolve, reject });
      this.channel.publish(
        this.exchange,
        message.eventType,
        Buffer.from(JSON.stringify(message.payload)),
        {
          persistent: true,
          mandatory: true,
          contentType: 'application/json',
          contentEncoding: 'utf-8',
          type: message.eventType,
          messageId: message.eventId,
          correlationId: message.correlationId,
          timestamp: Date.parse(message.occurredAt),
          headers: {
            schemaVersion: message.schemaVersion,
            aggregateType: message.aggregateType,
            aggregateId: message.aggregateId,
            causationId: message.causationId,
          },
        },
        (error) => {
          if (error) {
            this.finishRejected(message.eventId, error);
            return;
          }
          setImmediate(() => this.finishConfirmed(message.eventId));
        },
      );
    });
  }

  async close(): Promise<void> {
    await this.channel.waitForConfirms();
    await this.channel.close();
    await this.connection.close();
  }

  private rejectReturnedMessage(message: Message): void {
    const messageId = message.properties.messageId;
    if (messageId) {
      this.finishRejected(messageId, new Error(`RabbitMQ returned unroutable event ${messageId}`));
    }
  }

  private finishConfirmed(eventId: string): void {
    const pending = this.pending.get(eventId);
    if (!pending) return;
    this.pending.delete(eventId);
    pending.resolve();
  }

  private finishRejected(eventId: string, error: Error): void {
    const pending = this.pending.get(eventId);
    if (!pending) return;
    this.pending.delete(eventId);
    pending.reject(error);
  }

  private rejectAll(error: Error): void {
    for (const eventId of this.pending.keys()) this.finishRejected(eventId, error);
  }
}
