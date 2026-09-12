import { describe, expect, it } from 'vitest';
import { reconcileAmounts } from '../../../src/modules/accounting/domain/reconciliation.js';

describe('accounting reconciliation', () => {
  it('matches exact decimal totals without floating point', () => {
    expect(reconcileAmounts('100.10', '100.10', 'DZD', 2)).toEqual({ difference: '0.00', state: 'MATCHED' });
  });
  it('reports a signed variance', () => {
    expect(reconcileAmounts('99.99', '100.10', 'DZD', 2)).toEqual({ difference: '-0.11', state: 'VARIANCE' });
  });
});
