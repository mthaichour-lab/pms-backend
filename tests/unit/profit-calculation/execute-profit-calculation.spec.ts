import { describe, expect, it, vi } from 'vitest';

import { ExecuteProfitCalculation } from '../../../src/modules/profit-calculation/application/execute-profit-calculation.js';

const request = {
  runId: '17146c36-a0cb-4e0a-b095-60b67c945eb9', poolId: 'POOL-DZD-1',
  businessDate: '2026-08-28', rulesVersion: 'rules-2026.1',
  correlationId: 'a1d817e4-657f-475f-a96a-7eecb8f93acc',
  requestedBy: 'maker-1',
};

describe('ExecuteProfitCalculation', () => {
  it('creates deterministic input and output proofs inside the repository boundary', async () => {
    const executeAtomically = vi.fn(async (_request, calculate) => {
      const result = calculate({
        distributableAmount: '10.00', currency: 'DZD', amountScale: 2,
        sourceReference: 'ledger-close-1',
        weights: [{ participantId: 'a', weight: '1' }, { participantId: 'b', weight: '3' }],
      });
      expect(result.allocations.map((item: { amount: string }) => item.amount)).toEqual(['2.50', '7.50']);
      expect(result.inputChecksumSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(result.outputChecksumSha256).toMatch(/^[a-f0-9]{64}$/);
      return { status: 'CALCULATED' as const, outputChecksumSha256: result.outputChecksumSha256 };
    });
    await expect(new ExecuteProfitCalculation({ executeAtomically }).execute(request)).resolves.toMatchObject({
      status: 'CALCULATED',
    });
  });
});
