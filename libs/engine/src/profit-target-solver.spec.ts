import { describe, expect, it } from 'vitest';
import { solveProfitTarget, type ProfitTargetSolverInput } from './profit-target-solver.js';

const baseline: Omit<ProfitTargetSolverInput, 'lever'> = {
  backingBase: '10000', targetNetRate: '0.08', currentInvestorProfit: '700', distributableProfitBeforeShare: '1000',
  currentInvestorKey: '0.70', availableBankShareForTanazul: '200',
  perMinimumAdjustment: '-100', perMaximumAdjustment: '150', irrMinimumAdjustment: '-50', irrMaximumAdjustment: '75',
};

describe('solveProfitTarget', () => {
  it('refuse l’augmentation immédiate de clé et propose les deux issues conformes', () => {
    const result = solveProfitTarget({ ...baseline, lever: 'DISTRIBUTION_KEY' });
    expect(result).toMatchObject({
      status: 'NEXT_PERIOD_OR_TANAZUL', requiredValue: '0.800000000000',
      alternatives: ['PUBLISH_KEY_FOR_NEXT_PERIOD', 'USE_DOCUMENTED_TANAZUL'],
    });
  });

  it('rend le tanazul applicable immédiatement mais soumis à documentation Charia', () => {
    const result = solveProfitTarget({ ...baseline, lever: 'TANAZUL' });
    expect(result).toMatchObject({ status: 'APPLICABLE', requiredValue: '100.000000000000' });
    expect(result.governance).toEqual(['DOCUMENT_TANAZUL', 'REPORT_TO_SHARIA_COMMITTEE']);
  });

  it.each(['PER', 'IRR'] as const)('soumet le levier %s aux workflows ALCO et Charia', (lever) => {
    const input = lever === 'IRR' ? { ...baseline, targetNetRate: '0.075' } : baseline;
    const result = solveProfitTarget({ ...input, lever });
    expect(result.status).toBe('GOVERNANCE_REQUIRED');
    expect(result.governance).toEqual(['ALCO_APPROVAL_REQUIRED', 'SHARIA_COMMITTEE_APPROVAL_REQUIRED']);
  });

  it('retourne la plage atteignable lorsque la cible dépasse la capacité du levier', () => {
    const result = solveProfitTarget({ ...baseline, targetNetRate: '0.12', lever: 'TANAZUL' });
    expect(result).toMatchObject({
      status: 'OUT_OF_RANGE',
      achievableNetRateMinimum: '0.070000000000', achievableNetRateMaximum: '0.090000000000',
    });
    expect(result.requiredValue).toBeUndefined();
  });
});
