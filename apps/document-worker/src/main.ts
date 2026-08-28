import { ClamAvAntivirusAdapter } from '../../../src/infrastructure/antivirus/clamav.adapter.js';
import { HttpLandingStorageAdapter } from '../../../src/infrastructure/landing/landing-http.adapter.js';
import { RabbitMqEventConsumer } from '../../../src/infrastructure/messaging/rabbitmq-event-consumer.adapter.js';
import { PaperlessHttpAdapter } from '../../../src/infrastructure/paperless/paperless-http.adapter.js';
import { createPostgresPool } from '../../../src/infrastructure/persistence/postgres-client.js';
import { PostgresDocumentReferenceRepository } from '../../../src/infrastructure/persistence/postgres-document-reference.repository.js';
import { PostgresInboxRepository } from '../../../src/infrastructure/persistence/postgres-inbox.repository.js';
import { WormHttpAdapter } from '../../../src/infrastructure/worm/worm-http.adapter.js';
import { ArchiveDocument } from '../../../src/modules/documents/application/archive-document.js';
import { DocumentMessageHandler } from './document-message-handler.js';
import { documentWorker } from './worker.js';

async function bootstrap(): Promise<void> {
  const pool = createPostgresPool({
    connectionString: requiredEnvironment('DATABASE_URL'),
    application_name: documentWorker.name,
  });
  const archiveDocument = new ArchiveDocument(
    new ClamAvAntivirusAdapter({
      host: requiredEnvironment('CLAMAV_HOST'),
      port: positiveIntegerEnvironment('CLAMAV_PORT', 3310),
    }),
    new PaperlessHttpAdapter({
      baseUrl: requiredEnvironment('PAPERLESS_URL'),
      token: requiredEnvironment('PAPERLESS_TOKEN'),
    }),
    new WormHttpAdapter({
      baseUrl: requiredEnvironment('WORM_URL'),
      workloadToken: () => requiredEnvironment('WORM_WORKLOAD_TOKEN'),
      retentionClass: requiredEnvironment('WORM_RETENTION_CLASS'),
    }),
    new PostgresDocumentReferenceRepository(pool),
  );
  const handler = new DocumentMessageHandler(
    new PostgresInboxRepository(pool),
    new HttpLandingStorageAdapter({
      baseUrl: requiredEnvironment('LANDING_URL'),
      workloadToken: () => requiredEnvironment('LANDING_WORKLOAD_TOKEN'),
    }),
    archiveDocument,
  );
  const consumer = await RabbitMqEventConsumer.connect({
    url: requiredEnvironment('RABBITMQ_URL'),
    exchange: process.env['RABBITMQ_EVENTS_EXCHANGE'] ?? 'pms.events',
    queue: documentWorker.queue,
    routingKey: documentWorker.queue,
    concurrency: documentWorker.concurrency,
  });
  await consumer.start((message) => handler.handle(message));
  console.log(JSON.stringify({ event: 'document-worker.ready', queue: documentWorker.queue }));

  let stopping = false;
  const stop = async (signal: NodeJS.Signals) => {
    if (stopping) return;
    stopping = true;
    console.log(JSON.stringify({ event: 'document-worker.stopping', signal }));
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

function positiveIntegerEnvironment(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

void bootstrap().catch((error: unknown) => {
  console.error(JSON.stringify({
    event: 'document-worker.bootstrap.failed',
    error: error instanceof Error ? error.message : 'unknown error',
  }));
  process.exitCode = 1;
});
