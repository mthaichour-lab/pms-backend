import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

import { RabbitMqEventPublisher } from '../../../src/infrastructure/messaging/rabbitmq-event-publisher.adapter.js';

type TestChannel = EventEmitter & { publish: ReturnType<typeof vi.fn> };

const event = {
  eventId: '1d858fa9-8e21-457c-b3e8-a6c0329071c9',
  eventType: 'pms.calculation.requested.v1',
  schemaVersion: 1,
  aggregateType: 'CalculationRun',
  aggregateId: 'run-1',
  correlationId: '5e0829b7-f5c9-4e38-a2fa-a98f69520553',
  occurredAt: '2026-08-28T00:00:00.000Z',
  payload: { runId: 'run-1' },
};

describe('RabbitMqEventPublisher', () => {
  it('publishes persistent mandatory messages and waits for broker confirmation', async () => {
    const channel = new EventEmitter() as EventEmitter & {
      publish: ReturnType<typeof vi.fn>;
    };
    channel.publish = vi.fn((_exchange, _routingKey, _content, _options, callback) => {
      callback(undefined);
      return true;
    });
    const publisher = new (RabbitMqEventPublisher as unknown as new (
      connection: unknown,
      channel: TestChannel,
      exchange: string,
    ) => RabbitMqEventPublisher)({}, channel, 'pms.events');

    await expect(publisher.publish(event)).resolves.toBeUndefined();
    expect(channel.publish).toHaveBeenCalledWith(
      'pms.events',
      event.eventType,
      expect.any(Buffer),
      expect.objectContaining({
        persistent: true,
        mandatory: true,
        messageId: event.eventId,
        correlationId: event.correlationId,
      }),
      expect.any(Function),
    );
  });

  it('rejects broker nacks', async () => {
    const channel = new EventEmitter() as EventEmitter & {
      publish: ReturnType<typeof vi.fn>;
    };
    channel.publish = vi.fn((_exchange, _routingKey, _content, _options, callback) => {
      callback(new Error('broker nack'));
      return true;
    });
    const publisher = new (RabbitMqEventPublisher as unknown as new (
      connection: unknown,
      channel: TestChannel,
      exchange: string,
    ) => RabbitMqEventPublisher)({}, channel, 'pms.events');

    await expect(publisher.publish(event)).rejects.toThrow('broker nack');
  });
});
