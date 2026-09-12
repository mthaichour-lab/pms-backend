import { describe, expect, it, vi } from 'vitest';

import { ValidateInvestmentPositions } from '../../../src/modules/cbs-ingestion/application/validate-investment-positions.js';

describe('ValidateInvestmentPositions', () => {
  const validInspection = {
    rowCount: 12, invalidBusinessDateCount: 0, manifestRowCount: 12,
    manifestBalanceTotal: '1500.00', stagedBalanceTotal: '1500.000000000000',
    unknownCurrencyCount: 0, unknownProductCount: 0, invalidChronologyCount: 0,
  };

  it('validates a non-empty batch whose dates reconcile', async () => {
    const recordDecision = vi.fn().mockResolvedValue(undefined);
    const useCase = new ValidateInvestmentPositions({
      inspect: async () => validInspection, recordDecision, quarantineInvalidRows: vi.fn(),
    });
    await expect(useCase.execute('batch-1', '2026-08-28')).resolves.toBe('VALIDATED');
    expect(recordDecision).toHaveBeenCalledWith('batch-1', 'VALIDATED');
  });

  it('rejects empty or date-inconsistent batches with explicit controls', async () => {
    const recordDecision = vi.fn().mockResolvedValue(undefined);
    const quarantineInvalidRows = vi.fn().mockResolvedValue(2);
    const useCase = new ValidateInvestmentPositions({
      inspect: async () => ({ ...validInspection, rowCount: 0, invalidBusinessDateCount: 2, stagedBalanceTotal: '0' }),
      recordDecision, quarantineInvalidRows,
    });
    await expect(useCase.execute('batch-1', '2026-08-28')).resolves.toBe('REJECTED');
    expect(recordDecision).toHaveBeenCalledWith(
      'batch-1', 'REJECTED', 'EMPTY_BATCH,BUSINESS_DATE_MISMATCH,MANIFEST_ROW_COUNT_MISMATCH,MANIFEST_BALANCE_MISMATCH',
    );
    expect(quarantineInvalidRows).toHaveBeenCalledWith('batch-1', '2026-08-28');
  });
});
