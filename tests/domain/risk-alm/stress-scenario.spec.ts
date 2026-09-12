import { describe, expect, it } from 'vitest';
import { executeStressScenario } from '../../../src/modules/risk-alm/domain/stress-scenario.js';

describe('stress scenario', () => {
  it('applies signed basis-point shocks with exact half-up rounding', () => {
    expect(executeStressScenario('100.00', 'DZD', 2, [
      { bucket: 'ADVERSE', basisPoints: -1250 }, { bucket: 'UPSIDE', basisPoints: 500 },
    ])).toEqual([
      { bucket: 'ADVERSE', basisPoints: -1250, stressedAmount: '87.50', impactAmount: '-12.50' },
      { bucket: 'UPSIDE', basisPoints: 500, stressedAmount: '105.00', impactAmount: '5.00' },
    ]);
  });

  it('rejects duplicate buckets', () => {
    expect(() => executeStressScenario('10', 'DZD', 0, [
      { bucket: 'SAME', basisPoints: 10 }, { bucket: 'SAME', basisPoints: 20 },
    ])).toThrow('unique');
  });
});
