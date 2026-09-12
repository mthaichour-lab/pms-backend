import { describe, expect, it, vi } from 'vitest';

import { PublishInvestmentPositions } from '../../../src/modules/cbs-ingestion/application/publish-investment-positions.js';

describe('PublishInvestmentPositions', () => {
  it('delegates the all-or-nothing publication to its transaction boundary', async () => {
    const publish = vi.fn().mockResolvedValue(25);
    const repository = { isPublished: vi.fn().mockResolvedValue(false), customerReferences: vi.fn().mockResolvedValue(['CBS-1', 'CBS-2', 'CBS-1']), publish };
    const tokenize = vi.fn().mockResolvedValue(['tok_1234567890123456', 'tok_abcdefghijklmnop']);
    const useCase = new PublishInvestmentPositions(repository, { tokenize });
    await expect(useCase.execute('batch-1', '17146c36-a0cb-4e0a-b095-60b67c945eb9')).resolves.toBe(25);
    expect(tokenize).toHaveBeenCalledWith(['CBS-1', 'CBS-2'], { batchId: 'batch-1', correlationId: '17146c36-a0cb-4e0a-b095-60b67c945eb9' });
    expect(publish).toHaveBeenCalledWith('batch-1', new Map([['CBS-1', 'tok_1234567890123456'], ['CBS-2', 'tok_abcdefghijklmnop']]));
  });
  it('does not call the vault or publish again for a published batch', async () => {
    const tokenize = vi.fn(); const publish = vi.fn();
    const useCase = new PublishInvestmentPositions({ isPublished: async () => true, customerReferences: vi.fn(), publish }, { tokenize });
    await expect(useCase.execute('batch-1', '17146c36-a0cb-4e0a-b095-60b67c945eb9')).resolves.toBe(0);
    expect(tokenize).not.toHaveBeenCalled(); expect(publish).not.toHaveBeenCalled();
  });
});
