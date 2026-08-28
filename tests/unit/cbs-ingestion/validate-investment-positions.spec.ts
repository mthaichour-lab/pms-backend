import { describe, expect, it, vi } from 'vitest';

import { ValidateInvestmentPositions } from '../../../src/modules/cbs-ingestion/application/validate-investment-positions.js';

describe('ValidateInvestmentPositions', () => {
  it('validates a non-empty batch whose dates reconcile', async () => {
    const recordDecision = vi.fn().mockResolvedValue(undefined);
    const useCase = new ValidateInvestmentPositions({
      inspect: async () => ({ rowCount: 12, invalidBusinessDateCount: 0 }), recordDecision,
    });
    await expect(useCase.execute('batch-1', '2026-08-28')).resolves.toBe('VALIDATED');
    expect(recordDecision).toHaveBeenCalledWith('batch-1', 'VALIDATED');
  });

  it('rejects empty or date-inconsistent batches with explicit controls', async () => {
    const recordDecision = vi.fn().mockResolvedValue(undefined);
    const useCase = new ValidateInvestmentPositions({
      inspect: async () => ({ rowCount: 0, invalidBusinessDateCount: 2 }), recordDecision,
    });
    await expect(useCase.execute('batch-1', '2026-08-28')).resolves.toBe('REJECTED');
    expect(recordDecision).toHaveBeenCalledWith(
      'batch-1', 'REJECTED', 'EMPTY_BATCH,BUSINESS_DATE_MISMATCH',
    );
  });
});
