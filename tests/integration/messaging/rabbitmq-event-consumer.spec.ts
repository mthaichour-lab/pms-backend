import { EventEmitter } from 'node:events';
import type { ConsumeMessage } from 'amqplib';
import { describe, expect, it, vi } from 'vitest';

import { RabbitMqEventConsumer } from '../../../src/infrastructure/messaging/rabbitmq-event-consumer.adapter.js';

describe('RabbitMqEventConsumer', () => {
  it('acknowledges only after successful handling', async () => {
    let callback: ((message: ConsumeMessage | null) => void) | undefined;
    const channel = Object.assign(new EventEmitter(), {
      consume: vi.fn(async (_queue, handler) => {
        callback = handler;
        return { consumerTag: 'consumer-1' };
      }),
      ack: vi.fn(),
      nack: vi.fn(),
    });
    const consumer = new RabbitMqEventConsumer({} as never, channel as never, 'queue-1');
    const handler = vi.fn().mockResolvedValue(undefined);
    await consumer.start(handler);
    const delivery = message();

    callback?.(delivery);
    await vi.waitFor(() => expect(channel.ack).toHaveBeenCalledWith(delivery));
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('dead-letters invalid or failed messages without requeue loops', async () => {
    let callback: ((message: ConsumeMessage | null) => void) | undefined;
    const channel = Object.assign(new EventEmitter(), {
      consume: vi.fn(async (_queue, handler) => {
        callback = handler;
        return { consumerTag: 'consumer-1' };
      }),
      ack: vi.fn(),
      nack: vi.fn(),
    });
    const consumer = new RabbitMqEventConsumer({} as never, channel as never, 'queue-1');
    await consumer.start(vi.fn().mockRejectedValue(new Error('business failure')));
    const delivery = message();

    callback?.(delivery);
    await vi.waitFor(() =>
      expect(channel.nack).toHaveBeenCalledWith(delivery, false, false),
    );
    expect(channel.ack).not.toHaveBeenCalled();
  });
});

function message(): ConsumeMessage {
  return {
    content: Buffer.from(JSON.stringify({ runId: 'run-1' })),
    fields: {} as ConsumeMessage['fields'],
    properties: {
      messageId: '5f01db75-c587-48f0-843c-c6636259c7bb',
      type: 'pms.calculation.requested.v1',
      correlationId: 'f51f0210-56e2-48e2-a8a8-478965678d26',
      timestamp: Date.parse('2026-08-28T00:00:00.000Z'),
      headers: { schemaVersion: 1, aggregateType: 'Run', aggregateId: 'run-1' },
    } as unknown as ConsumeMessage['properties'],
  };
}
