import { describe, expect, it, vi } from 'vitest';

import { PostApprovedCalculation } from '../../../src/modules/accounting/application/post-approved-calculation.js';

describe('PostApprovedCalculation', () => {
  it('builds a balanced journal within the atomic posting boundary', async () => {
    const postAtomically = vi.fn(async (_command, buildLines) => {
      const lines = buildLines({
        distributableAmount: '10.00', currency: 'DZD', amountScale: 2,
        allocations: [
          { participantId: '17146c36-a0cb-4e0a-b095-60b67c945eb9', amount: '10.00', currency: 'DZD' },
        ],
      });
      expect(lines).toHaveLength(2);
      return { state: 'POSTED' as const, journalEntryId: 'a1d817e4-657f-475f-a96a-7eecb8f93acc' };
    });
    const useCase = new PostApprovedCalculation({ postAtomically });
    await expect(useCase.execute({
      runId: '17146c36-a0cb-4e0a-b095-60b67c945eb9', actorId: 'poster-1',
      justification: 'Comptabilisation après approbation', idempotencyKey: 'posting-action-0001',
    })).resolves.toMatchObject({ state: 'POSTED' });
  });
});
