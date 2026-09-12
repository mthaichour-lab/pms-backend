import { RabbitMqEventConsumer } from '../../../src/infrastructure/messaging/rabbitmq-event-consumer.adapter.js';
import { PostgresClosingControlRepository } from '../../../src/infrastructure/persistence/postgres-closing-control.repository.js';
import { createPostgresPool } from '../../../src/infrastructure/persistence/postgres-client.js';
import { PostgresInboxRepository } from '../../../src/infrastructure/persistence/postgres-inbox.repository.js';
import { EvaluateClosingRequest } from '../../../src/modules/closing-workflow/application/evaluate-closing-request.js';
import { ClosingMessageHandler } from './closing-message-handler.js';
import { closingWorker } from './worker.js';

async function bootstrap(): Promise<void> {
  const queue = requiredQueue(closingWorker.queue);
  const pool = createPostgresPool({
    connectionString: requiredEnvironment('DATABASE_URL'), application_name: closingWorker.name,
  });
  const handler = new ClosingMessageHandler(
    new PostgresInboxRepository(pool),
    new EvaluateClosingRequest(new PostgresClosingControlRepository(pool)),
  );
  const consumer = await RabbitMqEventConsumer.connect({
    url: requiredEnvironment('RABBITMQ_URL'),
    exchange: process.env['RABBITMQ_EVENTS_EXCHANGE'] ?? 'pms.events',
    queue, routingKey: queue, concurrency: closingWorker.concurrency,
  });
  await consumer.start((message) => handler.handle(message));
  console.log(JSON.stringify({ event: 'closing-worker.ready', queue }));
  let stopping = false;
  const stop = async (signal: NodeJS.Signals) => {
    if (stopping) return;
    stopping = true;
    console.log(JSON.stringify({ event: 'closing-worker.stopping', signal }));
    await consumer.close();
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

function requiredQueue(queue: string | undefined): string {
  if (!queue) throw new Error('closing-worker queue is required');
  return queue;
}

void bootstrap().catch((error: unknown) => {
  console.error(JSON.stringify({
    event: 'closing-worker.bootstrap.failed',
    error: error instanceof Error ? error.message : 'unknown error',
  }));
  process.exitCode = 1;
});
