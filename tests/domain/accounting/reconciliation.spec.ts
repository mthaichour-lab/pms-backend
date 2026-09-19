import { describe, expect, it } from 'vitest';
import { reconcileAmounts } from '../../../src/modules/accounting/domain/reconciliation.js';

describe('accounting reconciliation', () => {
  it('matches exact decimal totals without floating point', () => {
    expect(reconcileAmounts('100.10', '100.10', 'DZD', 2)).toEqual({ difference: '0.00', state: 'MATCHED' });
  });
  it('reports a signed variance', () => {
    expect(reconcileAmounts('99.99', '100.10', 'DZD', 2)).toEqual({ difference: '-0.11', state: 'VARIANCE' });
  });
  it('accepts database decimals with only insignificant digits beyond the currency scale', () => {
    expect(reconcileAmounts('100.100000000000', '100.10', 'DZD', 2))
      .toEqual({ difference: '0.00', state: 'MATCHED' });
    expect(reconcileAmounts('7.000000000000', '7', 'JPY', 0))
      .toEqual({ difference: '0', state: 'MATCHED' });
  });
  it('rejects value-bearing digits beyond the currency scale', () => {
    expect(() => reconcileAmounts('100.101000000000', '100.10', 'DZD', 2))
      .toThrow('exceeds scale 2');
  });
});
