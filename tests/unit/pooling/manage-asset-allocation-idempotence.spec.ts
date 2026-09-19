import { describe, expect, it, vi } from 'vitest';
import { ManageAssetAllocation } from '../../../src/modules/pooling/application/manage-asset-allocation.js';

const command = {
  allocationId: '11111111-1111-4111-8111-111111111111',
  assetId: '22222222-2222-4222-8222-222222222222',
  poolId: 'POOL_DZD',
  percentage: '20',
  effectiveFrom: '2026-08-29',
  justification: 'Approved pool allocation',
};

function service(save = vi.fn()) {
  return new ManageAssetAllocation({
    allocatedPercentage: async () => '0',
    preconditions: async () => ({ activeAnomalies: [], hasPriorAllocation: false, approvalValid: false }),
    save,
    history: vi.fn(),
  });
}

describe('ManageAssetAllocation idempotence boundary', () => {
  it('rejects unsafe idempotency keys before persistence', async () => {
    const save = vi.fn();
    await expect(service(save).allocate(command, 'unsafe key')).rejects.toThrow('idempotency key');
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects malformed correlation ids before persistence', async () => {
    const save = vi.fn();
    await expect(service(save).allocate(command, 'allocation-2026-08-29', 'not-a-uuid')).rejects.toThrow('correlation identifier');
    expect(save).not.toHaveBeenCalled();
  });
});
