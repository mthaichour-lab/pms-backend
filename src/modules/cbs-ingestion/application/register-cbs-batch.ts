export interface CbsBatchDescriptor {
  batchId: string;
  source: string;
  businessDate: string;
  flowType: string;
  sequence: number;
  schemaVersion: number;
  checksumSha256: string;
  objectKey: string;
  manifestRowCount: number;
  manifestBalanceTotal: string;
}

export interface CbsBatchRepository {
  registerReceived(batch: CbsBatchDescriptor): Promise<{
    status: 'CREATED' | 'EXISTING';
    batchId: string;
    state: CbsBatchState;
  }>;
  transition(
    batchId: string,
    expectedState: CbsBatchState,
    nextState: CbsBatchState,
    reason?: string,
  ): Promise<void>;
}

export class RegisterCbsBatch {
  constructor(private readonly repository: CbsBatchRepository) {}

  execute(batch: CbsBatchDescriptor): Promise<{
    status: 'CREATED' | 'EXISTING'; batchId: string; state: CbsBatchState;
  }> {
    validate(batch);
    return this.repository.registerReceived(batch);
  }
}

function validate(batch: CbsBatchDescriptor): void {
  if (!/^[a-f0-9]{64}$/.test(batch.checksumSha256)) throw new TypeError('Invalid CBS batch checksum');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(batch.businessDate)) throw new TypeError('Invalid CBS business date');
  if (!Number.isInteger(batch.sequence) || batch.sequence < 0) throw new TypeError('Invalid CBS sequence');
  if (!Number.isInteger(batch.schemaVersion) || batch.schemaVersion < 1) throw new TypeError('Invalid CBS schema version');
  if (!Number.isInteger(batch.manifestRowCount) || batch.manifestRowCount < 0) throw new TypeError('Invalid CBS manifest row count');
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(batch.manifestBalanceTotal)) throw new TypeError('Invalid CBS manifest balance total');
  for (const [name, value] of Object.entries({ source: batch.source, flowType: batch.flowType, objectKey: batch.objectKey })) {
    if (!value.trim()) throw new TypeError(`Invalid CBS ${name}`);
  }
}
import type { CbsBatchState } from '../domain/batch-state.js';
