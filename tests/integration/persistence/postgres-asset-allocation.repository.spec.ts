import { describe, expect, it, vi } from 'vitest';

import { PostgresAssetAllocationRepository } from '../../../src/infrastructure/persistence/postgres-asset-allocation.repository.js';

describe('PostgresAssetAllocationRepository', () => {
  it('lists token-free asset positions with pagination metadata', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ asset_id: 'a1d817e4-657f-475f-a96a-7eecb8f93acc', asset_code: 'MUR-001', currency_code: 'DZD', outstanding_amount: '100.000000000000', financing_type: 'MURABAHA' }] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] });
    const repository = new PostgresAssetAllocationRepository({ query } as never);
    await expect(repository.listAssets(25, 0)).resolves.toEqual({ items: [{ assetId: 'a1d817e4-657f-475f-a96a-7eecb8f93acc', assetCode: 'MUR-001', currency: 'DZD', outstandingAmount: '100.000000000000', financingType: 'MURABAHA' }], total: 1 });
    expect(String(query.mock.calls[0]?.[0])).toContain('FROM pooling.asset_position');
    expect(query.mock.calls[0]?.[1]).toEqual([25, 0]);
  });

  it('keeps the UUID asset and text approval resource comparison type-safe', async () => {
    const query = vi.fn(async (_sql: string, _values?: unknown[]) => ({
      rows: [{ asset_exists: false, active_anomalies: [], has_prior: false, approval_valid: false }],
    }));
    const repository = new PostgresAssetAllocationRepository({ query } as never);

    await expect(repository.preconditions(
      'a1d817e4-657f-475f-a96a-7eecb8f93acc',
      'allocation-approval-0001',
    )).resolves.toEqual({
      assetExists: false,
      activeAnomalies: [],
      hasPriorAllocation: false,
      approvalValid: false,
    });

    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain('asset_id=$1::uuid');
    expect(sql).toContain('resource_id=$1::text');
    expect(sql).toContain('idempotency_key=$2::text');
  });
});
