import { describe, expect, it } from 'vitest';
import { analyzeIntergenerationalEquity, simulateReserveMovement } from '../../../src/modules/reserves/domain/intergenerational-equity.js';

describe('intergenerational reserve equity', () => {
  it('distingue taux réalisé et taux distribué pour chaque génération', () => {
    const result = analyzeIntergenerationalEquity([
      { generationId: 'GEN-2025', participationBase: '10000', realizedProfit: '800', distributedProfit: '700' },
      { generationId: 'GEN-2026', participationBase: '20000', realizedProfit: '1200', distributedProfit: '1500' },
    ], '0.004');
    expect(result.generations[0]).toMatchObject({ realizedProfitRate: '0.080000000000', distributedProfitRate: '0.070000000000', distributionGapRate: '-0.010000000000' });
    expect(result.generations[1]).toMatchObject({ realizedProfitRate: '0.060000000000', distributedProfitRate: '0.075000000000', distributionGapRate: '0.015000000000' });
    expect(result).toMatchObject({ intergenerationalSpread: '0.005000000000', imbalanceDetected: true });
  });

  it('simule sur une copie de valeurs sans modifier le snapshot fourni', () => {
    const snapshot = { reserveType: 'PER' as const, investorBalance: '70', bankBalance: '30', investorMovement: '-7', bankMovement: '-3' };
    const frozen = { ...snapshot };
    const result = simulateReserveMovement(snapshot);
    expect(snapshot).toEqual(frozen);
    expect(result).toMatchObject({ simulation: true, before: { investorBalance: '70.000000000000', bankBalance: '30.000000000000' }, after: { investorBalance: '63.000000000000', bankBalance: '27.000000000000' }, totalMovement: '-10.000000000000' });
  });
});
