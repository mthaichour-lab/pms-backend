import { RabbitMqEventConsumer } from '../../../src/infrastructure/messaging/rabbitmq-event-consumer.adapter.js';
import { ClamAvAntivirusAdapter } from '../../../src/infrastructure/antivirus/clamav.adapter.js';
import { HttpLandingStorageAdapter } from '../../../src/infrastructure/landing/landing-http.adapter.js';
import { PostgresCbsBatchRepository } from '../../../src/infrastructure/persistence/postgres-cbs-batch.repository.js';
import { createPostgresPool } from '../../../src/infrastructure/persistence/postgres-client.js';
import { PostgresInboxRepository } from '../../../src/infrastructure/persistence/postgres-inbox.repository.js';
import { PostgresInvestmentPositionStagingRepository } from '../../../src/infrastructure/persistence/postgres-investment-position-staging.repository.js';
import { PostgresInvestmentPositionValidationRepository } from '../../../src/infrastructure/persistence/postgres-investment-position-validation.repository.js';
import { PostgresInvestmentPositionPublicationRepository } from '../../../src/infrastructure/persistence/postgres-investment-position-publication.repository.js';
import { RegisterCbsBatch } from '../../../src/modules/cbs-ingestion/application/register-cbs-batch.js';
import { ScanCbsBatch } from '../../../src/modules/cbs-ingestion/application/scan-cbs-batch.js';
import { StageInvestmentPositions } from '../../../src/modules/cbs-ingestion/application/stage-investment-positions.js';
import { ValidateInvestmentPositions } from '../../../src/modules/cbs-ingestion/application/validate-investment-positions.js';
import { PublishInvestmentPositions } from '../../../src/modules/cbs-ingestion/application/publish-investment-positions.js';
import { CbsBatchMessageHandler } from './cbs-batch-message-handler.js';
import { ingestionWorker } from './worker.js';
import { AuthenticateCbsManifest } from '../../../src/modules/cbs-ingestion/application/authenticate-cbs-manifest.js';
import { Ed25519CbsSignatureVerifier } from '../../../src/infrastructure/security/ed25519-cbs-signature-verifier.adapter.js';
import { HttpTokenVaultAdapter } from '../../../src/infrastructure/tokenization/http-token-vault.adapter.js';
import { CbsCustomerTokenizerAdapter } from '../../../src/infrastructure/tokenization/cbs-customer-tokenizer.adapter.js';
import { ManageTokenization } from '../../../src/modules/tokenization/application/token-vault.js';

async function bootstrap(): Promise<void> {
  const queue = requiredQueue(ingestionWorker.queue);
  const pool = createPostgresPool({
    connectionString: requiredEnvironment('DATABASE_URL'),
    application_name: ingestionWorker.name,
  });
  const repository = new PostgresCbsBatchRepository(pool);
  const handler = new CbsBatchMessageHandler(
    new PostgresInboxRepository(pool),
    new RegisterCbsBatch(repository),
    new ScanCbsBatch(
      repository,
      new HttpLandingStorageAdapter({
        baseUrl: requiredEnvironment('LANDING_URL'),
        workloadToken: () => requiredEnvironment('LANDING_WORKLOAD_TOKEN'),
      }),
      new ClamAvAntivirusAdapter({
        host: requiredEnvironment('CLAMAV_HOST'),
        port: positiveIntegerEnvironment('CLAMAV_PORT', 3310),
      }),
    ),
    new StageInvestmentPositions(new PostgresInvestmentPositionStagingRepository(pool)),
    new ValidateInvestmentPositions(new PostgresInvestmentPositionValidationRepository(pool)),
    new PublishInvestmentPositions(new PostgresInvestmentPositionPublicationRepository(pool), new CbsCustomerTokenizerAdapter(new ManageTokenization(new HttpTokenVaultAdapter(requiredEnvironment('TOKEN_VAULT_URL'), requiredEnvironment('TOKEN_VAULT_WORKLOAD_TOKEN'))))),
    new AuthenticateCbsManifest(
      new Ed25519CbsSignatureVerifier(sourcePublicKeys()), repository,
      { startHourUtc: nonNegativeIntegerEnvironment('CBS_WINDOW_START_HOUR_UTC', 0), endHourUtc: nonNegativeIntegerEnvironment('CBS_WINDOW_END_HOUR_UTC', 6) },
    ),
  );
  const consumer = await RabbitMqEventConsumer.connect({
    url: requiredEnvironment('RABBITMQ_URL'),
    exchange: process.env['RABBITMQ_EVENTS_EXCHANGE'] ?? 'pms.events',
    queue,
    routingKey: queue,
    concurrency: ingestionWorker.concurrency,
  });
  await consumer.start((message) => handler.handle(message));
  console.log(JSON.stringify({ event: 'ingestion-worker.ready', queue }));

  let stopping = false;
  const stop = async (signal: NodeJS.Signals) => {
    if (stopping) return;
    stopping = true;
    console.log(JSON.stringify({ event: 'ingestion-worker.stopping', signal }));
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
  if (!queue) throw new Error('ingestion-worker queue is required');
  return queue;
}

function positiveIntegerEnvironment(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function nonNegativeIntegerEnvironment(name: string, fallback: number): number {
  const value = process.env[name]; if (!value) return fallback;
  const parsed = Number(value); if (!Number.isInteger(parsed) || parsed < 0 || parsed > 23) throw new Error(`${name} must be an hour between 0 and 23`); return parsed;
}

function sourcePublicKeys(): Record<string, string> {
  const raw = requiredEnvironment('CBS_SOURCE_PUBLIC_KEYS_JSON');
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.values(parsed).some(value => typeof value !== 'string')) {
    throw new Error('CBS_SOURCE_PUBLIC_KEYS_JSON must be a source-to-PEM object');
  }
  return parsed as Record<string, string>;
}

void bootstrap().catch((error: unknown) => {
  console.error(JSON.stringify({
    event: 'ingestion-worker.bootstrap.failed',
    error: error instanceof Error ? error.message : 'unknown error',
  }));
  process.exitCode = 1;
});
