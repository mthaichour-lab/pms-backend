import { KmsHttpAuditSigner } from '../../../src/infrastructure/kms/kms-http-audit-signer.adapter.js';
import { RabbitMqEventConsumer } from '../../../src/infrastructure/messaging/rabbitmq-event-consumer.adapter.js';
import { PostgresAuditRepository } from '../../../src/infrastructure/persistence/postgres-audit.repository.js';
import { createPostgresPool } from '../../../src/infrastructure/persistence/postgres-client.js';
import { PostgresInboxRepository } from '../../../src/infrastructure/persistence/postgres-inbox.repository.js';
import { AuditMessageHandler } from './audit-message-handler.js';
import { auditWorker } from './worker.js';

async function bootstrap(): Promise<void> {
  const queue = requiredQueue(auditWorker.queue);
  const pool = createPostgresPool({ connectionString: requiredEnvironment('DATABASE_URL'), application_name: auditWorker.name });
  const signer = new KmsHttpAuditSigner({
    baseUrl: requiredEnvironment('KMS_URL'),
    keyId: requiredEnvironment('KMS_AUDIT_KEY_ID'),
    workloadToken: () => requiredEnvironment('KMS_WORKLOAD_TOKEN'),
  });
  const handler = new AuditMessageHandler(new PostgresInboxRepository(pool), new PostgresAuditRepository(pool, signer));
  const consumer = await RabbitMqEventConsumer.connect({
    url: requiredEnvironment('RABBITMQ_URL'),
    exchange: process.env['RABBITMQ_EVENTS_EXCHANGE'] ?? 'pms.events',
    queue,
    routingKey: queue,
    concurrency: auditWorker.concurrency,
  });
  await consumer.start((message) => handler.handle(message));
  console.log(JSON.stringify({ event: 'audit-worker.ready', queue }));

  let stopping = false;
  const stop = async (signal: NodeJS.Signals) => {
    if (stopping) return;
    stopping = true;
    console.log(JSON.stringify({ event: 'audit-worker.stopping', signal }));
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
  if (!queue) throw new Error('audit-worker queue is required');
  return queue;
}

void bootstrap().catch((error: unknown) => {
  console.error(JSON.stringify({ event: 'audit-worker.bootstrap.failed', error: error instanceof Error ? error.message : 'unknown error' }));
  process.exitCode = 1;
});
