import { RabbitMqEventConsumer } from '../../../src/infrastructure/messaging/rabbitmq-event-consumer.adapter.js';
import { PostgresCalculationExecutionRepository } from '../../../src/infrastructure/persistence/postgres-calculation-execution.repository.js';
import { createPostgresPool } from '../../../src/infrastructure/persistence/postgres-client.js';
import { PostgresInboxRepository } from '../../../src/infrastructure/persistence/postgres-inbox.repository.js';
import { ExecuteProfitCalculation } from '../../../src/modules/profit-calculation/application/execute-profit-calculation.js';
import { CalculationMessageHandler } from './calculation-message-handler.js';
import { calculationWorker } from './worker.js';

async function bootstrap(): Promise<void> {
  const queue = requiredQueue(calculationWorker.queue);
  const pool = createPostgresPool({
    connectionString: requiredEnvironment('DATABASE_URL'),
    application_name: calculationWorker.name,
  });
  const handler = new CalculationMessageHandler(
    new PostgresInboxRepository(pool),
    new ExecuteProfitCalculation(new PostgresCalculationExecutionRepository(pool)),
  );
  const consumer = await RabbitMqEventConsumer.connect({
    url: requiredEnvironment('RABBITMQ_URL'),
    exchange: process.env['RABBITMQ_EVENTS_EXCHANGE'] ?? 'pms.events',
    queue,
    routingKey: queue,
    concurrency: calculationWorker.concurrency,
  });
  await consumer.start((message) => handler.handle(message));
  console.log(JSON.stringify({ event: 'calculation-worker.ready', queue }));

  let stopping = false;
  const stop = async (signal: NodeJS.Signals) => {
    if (stopping) return;
    stopping = true;
    console.log(JSON.stringify({ event: 'calculation-worker.stopping', signal }));
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
  if (!queue) throw new Error('calculation-worker queue is required');
  return queue;
}

void bootstrap().catch((error: unknown) => {
  console.error(JSON.stringify({
    event: 'calculation-worker.bootstrap.failed',
    error: error instanceof Error ? error.message : 'unknown error',
  }));
  process.exitCode = 1;
});
