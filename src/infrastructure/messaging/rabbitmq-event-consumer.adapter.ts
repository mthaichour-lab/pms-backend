import {
  connect,
  type Channel,
  type ChannelModel,
  type ConsumeMessage,
} from 'amqplib';

import type { OutboxMessage } from './message-contracts.js';

export interface RabbitMqConsumerOptions {
  url: string;
  exchange: string;
  queue: string;
  routingKey: string;
  deadLetterExchange?: string;
  concurrency: number;
}

export class RabbitMqEventConsumer {
  private consumerTag?: string;

  constructor(
    private readonly connection: ChannelModel,
    private readonly channel: Channel,
    private readonly queue: string,
  ) {}

  static async connect(options: RabbitMqConsumerOptions): Promise<RabbitMqEventConsumer> {
    const connectionUrl = new URL(options.url);
    connectionUrl.searchParams.set('heartbeat', '30');
    const connection = await connect(connectionUrl.toString());
    const channel = await connection.createChannel();
    const deadLetterExchange = options.deadLetterExchange ?? 'pms.dlx';
    const deadLetterQueue = `${options.queue}.dlq`;
    await channel.assertExchange(options.exchange, 'topic', { durable: true });
    await channel.assertExchange(deadLetterExchange, 'topic', { durable: true });
    await channel.assertQueue(deadLetterQueue, { durable: true });
    await channel.bindQueue(deadLetterQueue, deadLetterExchange, deadLetterQueue);
    await channel.assertQueue(options.queue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': deadLetterExchange,
        'x-dead-letter-routing-key': deadLetterQueue,
      },
    });
    await channel.bindQueue(options.queue, options.exchange, options.routingKey);
    await channel.prefetch(options.concurrency);
    return new RabbitMqEventConsumer(connection, channel, options.queue);
  }

  async start(
    handler: (message: OutboxMessage) => Promise<unknown>,
  ): Promise<void> {
    if (this.consumerTag) throw new Error(`Consumer already started for ${this.queue}`);
    const result = await this.channel.consume(
      this.queue,
      (delivery) => void this.handleDelivery(delivery, handler),
      { noAck: false },
    );
    this.consumerTag = result.consumerTag;
  }

  async close(): Promise<void> {
    if (this.consumerTag) await this.channel.cancel(this.consumerTag);
    this.consumerTag = undefined;
    await this.channel.close();
    await this.connection.close();
  }

  private async handleDelivery(
    delivery: ConsumeMessage | null,
    handler: (message: OutboxMessage) => Promise<unknown>,
  ): Promise<void> {
    if (!delivery) return;
    try {
      await handler(toOutboxMessage(delivery));
      this.channel.ack(delivery);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'rabbitmq.message.failed',
          queue: this.queue,
          messageId: delivery.properties.messageId,
          error: error instanceof Error ? error.message : 'unknown error',
        }),
      );
      this.channel.nack(delivery, false, false);
    }
  }
}

function toOutboxMessage(delivery: ConsumeMessage): OutboxMessage {
  const properties = delivery.properties;
  const headers = properties.headers ?? {};
  if (!properties.messageId || !properties.type || !properties.correlationId) {
    throw new TypeError('RabbitMQ message is missing mandatory identity properties');
  }
  const payload: unknown = JSON.parse(delivery.content.toString('utf8'));
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('RabbitMQ event payload must be an object');
  }
  const schemaVersion = Number(headers['schemaVersion']);
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
    throw new TypeError('RabbitMQ event schemaVersion is invalid');
  }
  return {
    eventId: properties.messageId,
    eventType: properties.type,
    correlationId: properties.correlationId,
    causationId:
      typeof headers['causationId'] === 'string' ? headers['causationId'] : undefined,
    aggregateType: requiredHeader(headers, 'aggregateType'),
    aggregateId: requiredHeader(headers, 'aggregateId'),
    schemaVersion,
    occurredAt: new Date(properties.timestamp).toISOString(),
    payload: payload as Record<string, unknown>,
  };
}

function requiredHeader(headers: Record<string, unknown>, name: string): string {
  const value = headers[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`RabbitMQ event header is invalid: ${name}`);
  }
  return value;
}
