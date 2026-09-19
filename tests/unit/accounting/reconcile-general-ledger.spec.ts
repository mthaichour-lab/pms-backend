import { describe, expect, it, vi } from 'vitest';

import { ReconcileGeneralLedger } from '../../../src/modules/accounting/application/reconcile-general-ledger.js';

const validCommand = {
  businessDate: '2026-09-14',
  currency: 'DZD',
  generalLedgerAmount: '100.10',
  sourceReference: ' gl-export-20260914 ',
  sourceChecksumSha256: 'a'.repeat(64),
  actorId: ' finance-controller ',
};

describe('ReconcileGeneralLedger', () => {
  it('rejects a syntactically valid but impossible calendar date', () => {
    const useCase = new ReconcileGeneralLedger({ reconcileAtomically: vi.fn() });
    expect(() => useCase.execute({ ...validCommand, businessDate: '2026-02-30' }))
      .toThrow('Business date must use YYYY-MM-DD');
  });

  it('normalizes command metadata before entering the transaction boundary', async () => {
    const reconcileAtomically = vi.fn(async () => ({
      reconciliationId: 'af662dda-a96b-4e08-9781-f648cd9b11bb',
      state: 'MATCHED' as const,
      difference: '0.00',
    }));
    const useCase = new ReconcileGeneralLedger({ reconcileAtomically });
    await useCase.execute(validCommand);
    expect(reconcileAtomically).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceReference: 'gl-export-20260914', actorId: 'finance-controller',
      }),
      expect.any(Function),
    );
  });

  it('normalizes and validates an optional correlation identifier', async () => {
    const reconcileAtomically = vi.fn(async () => ({
      reconciliationId: 'af662dda-a96b-4e08-9781-f648cd9b11bb', state: 'MATCHED' as const, difference: '0.00',
    }));
    const useCase = new ReconcileGeneralLedger({ reconcileAtomically });
    await useCase.execute({ ...validCommand, correlationId: 'AF662DDA-A96B-4E08-9781-F648CD9B11BB' });
    const calls = reconcileAtomically.mock.calls as unknown as Array<[Record<string, unknown>]>;
    expect(calls[0]?.[0]).toEqual(expect.objectContaining({
      correlationId: 'af662dda-a96b-4e08-9781-f648cd9b11bb',
    }));
    expect(() => useCase.execute({ ...validCommand, correlationId: 'not-a-uuid' })).toThrow('correlation identifier');
  });
});
