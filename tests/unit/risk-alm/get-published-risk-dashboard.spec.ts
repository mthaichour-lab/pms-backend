import { describe, expect, it, vi } from 'vitest';
import { GetPublishedRiskDashboard } from '../../../src/modules/risk-alm/application/get-published-risk-dashboard.js';

describe('GetPublishedRiskDashboard', () => {
  it('retourne uniquement la projection du dernier run publié', async () => {
    const dashboard = { poolId:'POOL-001',runId:'run',businessDate:'2026-08-30',currency:'DZD',source:'LATEST_PUBLISHED_RUN' as const };
    const repository={findLatestPublished:vi.fn().mockResolvedValue(dashboard)};
    await expect(new GetPublishedRiskDashboard(repository).execute(' POOL-001 ')).resolves.toBe(dashboard);
    expect(repository.findLatestPublished).toHaveBeenCalledWith('POOL-001');
  });
  it('refuse toute projection qui ne provient pas du run publié', async () => {
    const repository={findLatestPublished:vi.fn().mockResolvedValue({source:'MANUAL'})};
    await expect(new GetPublishedRiskDashboard(repository as never).execute('POOL-001')).rejects.toThrow('source invariant');
  });
});
