import { describe, expect, it, vi } from 'vitest';

import { PublishInvestmentPositions } from '../../../src/modules/cbs-ingestion/application/publish-investment-positions.js';

describe('PublishInvestmentPositions', () => {
  it('delegates the all-or-nothing publication to its transaction boundary', async () => {
    const publish = vi.fn().mockResolvedValue(25);
    const useCase = new PublishInvestmentPositions({ publish });
    await expect(useCase.execute('batch-1')).resolves.toBe(25);
    expect(publish).toHaveBeenCalledWith('batch-1');
  });
});
