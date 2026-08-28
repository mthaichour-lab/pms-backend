import { OutboxRelay } from '../../../src/infrastructure/messaging/outbox-relay.js';
import { RabbitMqEventPublisher } from '../../../src/infrastructure/messaging/rabbitmq-event-publisher.adapter.js';
import { createPostgresPool } from '../../../src/infrastructure/persistence/postgres-client.js';
import { PostgresOutboxRepository } from '../../../src/infrastructure/persistence/postgres-outbox.repository.js';
import { OutboxScheduler } from './outbox-scheduler.js';

async function bootstrap(): Promise<void> {
  const databaseUrl = requiredEnvironment('DATABASE_URL');
  const rabbitMqUrl = requiredEnvironment('RABBITMQ_URL');
  const pool = createPostgresPool({ connectionString: databaseUrl });
  const publisher = await RabbitMqEventPublisher.connect({
    url: rabbitMqUrl,
    exchange: process.env['RABBITMQ_EVENTS_EXCHANGE'] ?? 'pms.events',
  });
  const repository = new PostgresOutboxRepository(
    pool,
    `${process.env['HOSTNAME'] ?? 'scheduler'}:${process.pid}`,
  );
  const relay = new OutboxRelay(repository, publisher);
  const scheduler = new OutboxScheduler(
    relay,
    positiveIntegerEnvironment('OUTBOX_POLL_INTERVAL_MS', 1000),
    positiveIntegerEnvironment('OUTBOX_BATCH_SIZE', 100),
  );
  scheduler.start();
  console.log(JSON.stringify({ event: 'scheduler.ready', jobs: ['outbox-relay'] }));

  let stopping = false;
  const stop = async (signal: NodeJS.Signals) => {
    if (stopping) return;
    stopping = true;
    console.log(JSON.stringify({ event: 'scheduler.stopping', signal }));
    await scheduler.stop();
    await publisher.close();
    await pool.end();
  };
  process.once('SIGINT', () => void stop('SIGINT'));
  process.once('SIGTERM', () => void stop('SIGTERM'));
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positiveIntegerEnvironment(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

void bootstrap().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      event: 'scheduler.bootstrap.failed',
      error: error instanceof Error ? error.message : 'unknown error',
    }),
  );
  process.exitCode = 1;
});
