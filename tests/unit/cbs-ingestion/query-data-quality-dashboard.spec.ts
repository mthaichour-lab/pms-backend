import { describe, expect, it, vi } from 'vitest';
import { QueryDataQualityDashboard } from '../../../src/modules/cbs-ingestion/application/query-data-quality-dashboard.js';

describe('QueryDataQualityDashboard', () => {
  it('applies bounded pagination defaults', async () => {
    const list = vi.fn().mockResolvedValue([]);
    await new QueryDataQualityDashboard({ list }).execute({ businessDate: '2026-08-29' });
    expect(list).toHaveBeenCalledWith({ businessDate: '2026-08-29', limit: 50, offset: 0 });
  });
  it('rejects unsafe pagination', async () => {
    const query = new QueryDataQualityDashboard({ list: vi.fn() });
    expect(() => query.execute({ limit: 201 })).toThrow('Limit must be between 1 and 200');
  });
});
