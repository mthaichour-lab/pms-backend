import { IdempotentConsumer } from '../../../src/infrastructure/messaging/idempotent-consumer.js';
import type { InboxRepository, OutboxMessage } from '../../../src/infrastructure/messaging/message-contracts.js';
import { RegisterCbsBatch } from '../../../src/modules/cbs-ingestion/application/register-cbs-batch.js';
import type { CbsBatchDescriptor } from '../../../src/modules/cbs-ingestion/application/register-cbs-batch.js';
import { ScanCbsBatch } from '../../../src/modules/cbs-ingestion/application/scan-cbs-batch.js';
import { StageInvestmentPositions } from '../../../src/modules/cbs-ingestion/application/stage-investment-positions.js';
import { ValidateInvestmentPositions } from '../../../src/modules/cbs-ingestion/application/validate-investment-positions.js';
import { PublishInvestmentPositions } from '../../../src/modules/cbs-ingestion/application/publish-investment-positions.js';
import { AuthenticateCbsManifest } from '../../../src/modules/cbs-ingestion/application/authenticate-cbs-manifest.js';

export class CbsBatchMessageHandler {
  private readonly consumer: IdempotentConsumer;

  constructor(
    inbox: InboxRepository,
    private readonly register: RegisterCbsBatch,
    private readonly scan?: ScanCbsBatch,
    private readonly stageInvestmentPositions?: StageInvestmentPositions,
    private readonly validateInvestmentPositions?: ValidateInvestmentPositions,
    private readonly publishInvestmentPositions?: PublishInvestmentPositions,
    private readonly authenticate?: AuthenticateCbsManifest,
  ) {
    this.consumer = new IdempotentConsumer('ingestion-worker', inbox);
  }

  handle(message: OutboxMessage): Promise<'PROCESSED' | 'DUPLICATE'> {
    return this.consumer.handle(message, async () => {
      const payload = message.payload;
      const batch: CbsBatchDescriptor = {
        batchId: stringField(payload, 'batchId'),
        source: stringField(payload, 'source'),
        businessDate: stringField(payload, 'businessDate'),
        flowType: stringField(payload, 'flowType'),
        sequence: integerField(payload, 'sequence'),
        schemaVersion: message.schemaVersion,
        checksumSha256: stringField(payload, 'checksumSha256'),
        objectKey: stringField(payload, 'objectKey'),
        manifestRowCount: integerField(payload, 'manifestRowCount'),
        manifestBalanceTotal: stringField(payload, 'manifestBalanceTotal'),
      };
      const registration = await this.register.execute(batch);
      if (['PUBLISHED', 'QUARANTINED', 'REJECTED', 'PARTIALLY_REJECTED', 'FAILED', 'CANCELLED'].includes(registration.state)) {
        return;
      }
      const authentication = registration.state === 'RECEIVED'
        ? await this.authenticate?.execute({
            ...batch,
            signatureBase64: stringField(payload, 'signatureBase64'),
            receivedAt: stringField(payload, 'receivedAt'),
          })
        : undefined;
      if (registration.state === 'RECEIVED' && !this.authenticate) throw new Error('CBS manifest authentication is not configured');
      if (authentication === 'REJECTED') return;
      const scan = registration.state === 'AUTHENTICATED' || authentication === 'AUTHENTICATED' || registration.state === 'SCANNED'
        ? await this.scan?.execute({ ...batch, batchId: registration.batchId })
        : undefined;
      if (scan?.state === 'SCANNED' && batch.flowType === 'INVESTMENT_POSITIONS') {
        if (!this.stageInvestmentPositions) throw new Error('Investment positions staging is not configured');
        await this.stageInvestmentPositions.execute(registration.batchId, scan.content);
      }
      if (
        batch.flowType === 'INVESTMENT_POSITIONS' &&
        (registration.state === 'STAGED' || scan?.state === 'SCANNED')
      ) {
        if (!this.validateInvestmentPositions) throw new Error('Investment positions validation is not configured');
        const validation = await this.validateInvestmentPositions.execute(registration.batchId, batch.businessDate);
        if (validation === 'VALIDATED') {
          if (!this.publishInvestmentPositions) throw new Error('Investment positions publication is not configured');
          await this.publishInvestmentPositions.execute(registration.batchId, message.correlationId);
        }
      }
      if (
        batch.flowType === 'INVESTMENT_POSITIONS' &&
        (registration.state === 'VALIDATED' || registration.state === 'APPROVED')
      ) {
        if (!this.publishInvestmentPositions) throw new Error('Investment positions publication is not configured');
        await this.publishInvestmentPositions.execute(registration.batchId, message.correlationId);
      }
    });
  }
}

function stringField(payload: Readonly<Record<string, unknown>>, name: string): string {
  const value = payload[name];
  if (typeof value !== 'string' || !value) throw new TypeError(`Invalid CBS event field: ${name}`);
  return value;
}

function integerField(payload: Readonly<Record<string, unknown>>, name: string): number {
  const value = payload[name];
  if (!Number.isInteger(value)) throw new TypeError(`Invalid CBS event field: ${name}`);
  return value as number;
}
