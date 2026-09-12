import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { ScanCbsBatch } from '../../../src/modules/cbs-ingestion/application/scan-cbs-batch.js';
import type { CbsBatchDescriptor, CbsBatchRepository } from '../../../src/modules/cbs-ingestion/application/register-cbs-batch.js';

const bytes = new TextEncoder().encode('CBS batch');
const batch: CbsBatchDescriptor = {
  batchId: '17146c36-a0cb-4e0a-b095-60b67c945eb9', source: 'CBS',
  businessDate: '2026-08-28', flowType: 'BALANCES', sequence: 1, schemaVersion: 1,
  checksumSha256: createHash('sha256').update(bytes).digest('hex'), objectKey: 'batch.csv',
  manifestRowCount: 1, manifestBalanceTotal: '100.00',
};

function repository(transition = vi.fn().mockResolvedValue(undefined)): CbsBatchRepository {
  return {
    registerReceived: async () => ({ status: 'CREATED', batchId: batch.batchId, state: 'RECEIVED' }),
    transition,
  };
}

describe('ScanCbsBatch', () => {
  it('marks a clean batch with matching checksum as scanned', async () => {
    const transition = vi.fn().mockResolvedValue(undefined);
    const useCase = new ScanCbsBatch(repository(transition), {
      load: async () => ({ bytes, filename: 'batch.csv', mediaType: 'text/csv' }),
    }, { scan: async () => ({ clean: true }) });
    await expect(useCase.execute(batch)).resolves.toMatchObject({ state: 'SCANNED' });
    expect(transition).toHaveBeenCalledWith(batch.batchId, 'AUTHENTICATED', 'SCANNED');
  });

  it('quarantines a checksum mismatch without invoking antivirus', async () => {
    const transition = vi.fn().mockResolvedValue(undefined);
    const scan = vi.fn();
    const useCase = new ScanCbsBatch(repository(transition), {
      load: async () => ({ bytes: new Uint8Array([1]), filename: 'batch.csv', mediaType: 'text/csv' }),
    }, { scan });
    await expect(useCase.execute(batch)).resolves.toEqual({ state: 'QUARANTINED' });
    expect(scan).not.toHaveBeenCalled();
    expect(transition).toHaveBeenCalledWith(batch.batchId, 'AUTHENTICATED', 'QUARANTINED', 'CHECKSUM_MISMATCH');
  });
});
