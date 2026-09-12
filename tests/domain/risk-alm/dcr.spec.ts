import { describe, expect, it } from 'vitest';
import { calculateDcr } from '../../../src/modules/risk-alm/domain/dcr.js';

describe('DCR', () => {
  it('calculates an exact six-decimal ratio and threshold state', () => {
    expect(calculateDcr({
      capitalDurationAmount: '125.00', riskWeightedDurationAmount: '100.00',
      currency: 'DZD', amountScale: 2, threshold: '1.200000',
    })).toEqual({ value: '1.250000', threshold: '1.200000', state: 'WITHIN_LIMIT' });
  });

  it('rounds half-up without floating point', () => {
    expect(calculateDcr({
      capitalDurationAmount: '2', riskWeightedDurationAmount: '3',
      currency: 'DZD', amountScale: 0, threshold: '0.7',
    })).toMatchObject({ value: '0.666667', state: 'BREACH' });
  });

  it('rejects a zero denominator', () => {
    expect(() => calculateDcr({
      capitalDurationAmount: '1', riskWeightedDurationAmount: '0',
      currency: 'DZD', amountScale: 0, threshold: '1',
    })).toThrow('must be positive');
  });
});
