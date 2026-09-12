import { describe, expect, it } from 'vitest';
import { calculateDistributablePoolProfit } from './distributable-pool-profit.js';

describe('calculateDistributablePoolProfit', () => {
  it('conserve exactement le résultat brut dans toute la cascade', () => {
    const result = calculateDistributablePoolProfit({
      poolId: 'POOL-001',
      revenue: '1250.55',
      approvedCharges: '100.10',
      losses: '50.05',
      nonCompliantIncome: '10.40',
      adjustments: '-20.00',
      bankEconomicShare: '80',
      moudaribRemuneration: '120',
      perAllocation: '30',
      irrAllocation: '20',
      poolParticipationBase: '50000',
    });

    expect(result.grossResult).toBe('1080.400000000000');
    expect(result.netDistributableProfit).toBe('1070.000000000000');
    expect(result.bankTotalShare).toBe('200.000000000000');
    expect(result.investorShare).toBe('820.000000000000');
    expect(result.conservationDifference).toBe('0.000000000000');
  });

  it('expose séparément les rendements global et de l’assiette partielle', () => {
    const result = calculateDistributablePoolProfit({
      poolId: 'POOL-002',
      revenue: '100',
      approvedCharges: '0',
      losses: '0',
      nonCompliantIncome: '0',
      adjustments: '0',
      bankEconomicShare: '10',
      moudaribRemuneration: '10',
      perAllocation: '5',
      irrAllocation: '5',
      poolParticipationBase: '1000',
      partialBackingBase: '400',
    });

    expect(result.poolReturnRate).toBe('0.100000000000');
    expect(result.partialBackingReturnRate).toBe('0.250000000000');
  });

  it('refuse une cascade dont les allocations dépassent le distribuable', () => {
    expect(() => calculateDistributablePoolProfit({
      poolId: 'POOL-003',
      revenue: '100',
      approvedCharges: '0',
      losses: '0',
      nonCompliantIncome: '0',
      adjustments: '0',
      bankEconomicShare: '80',
      moudaribRemuneration: '30',
      perAllocation: '0',
      irrAllocation: '0',
      poolParticipationBase: '1000',
    })).toThrow('exceed net distributable profit');
  });
});
