import { describe, expect, it } from 'vitest';
import { classifyLossAbsorption } from './loss-classification.js';

describe('classifyLossAbsorption', () => {
  it.each([
    'MANAGER_FAULT_OR_NEGLIGENCE',
    'MANDATE_VIOLATION',
    'SHARIA_NON_COMPLIANCE',
  ] as const)('impute intégralement %s à la banque sans toucher aux réserves', (cause) => {
    const result = classifyLossAbsorption({
      lossAmount: '100.00', cause, irrPolicy: 'APPROVED', availableIrr: '1000', availablePer: '1000', availableDepositorCapital: '1000',
    });
    expect(result).toMatchObject({
      liability: 'BANK', irrAbsorption: '0.00', perAbsorption: '0.00', depositorCapitalAbsorption: '0.00',
      bankAbsorption: '100.00', unabsorbedLoss: '0.00', conservationDifference: '0.00',
    });
  });

  it('applique la cascade IRR puis PER puis capital pour une perte ordinaire', () => {
    const result = classifyLossAbsorption({
      lossAmount: '100.00', cause: 'ORDINARY_MARKET_LOSS', irrPolicy: 'APPROVED',
      availableIrr: '20.00', availablePer: '30.00', availableDepositorCapital: '1000.00',
    });
    expect(result).toMatchObject({
      liability: 'INVESTORS', irrAbsorption: '20.00', perAbsorption: '30.00', depositorCapitalAbsorption: '50.00',
      bankAbsorption: '0.00', appliedCascade: ['IRR', 'PER', 'DEPOSITOR_CAPITAL'], conservationDifference: '0.00',
    });
  });

  it('interdit implicitement l’IRR quand sa politique n’est pas approuvée', () => {
    const result = classifyLossAbsorption({
      lossAmount: '40.00', cause: 'CREDIT_LOSS', irrPolicy: 'NOT_APPROVED',
      availableIrr: '100.00', availablePer: '10.00', availableDepositorCapital: '30.00',
    });
    expect(result).toMatchObject({ irrAbsorption: '0.00', perAbsorption: '10.00', depositorCapitalAbsorption: '30.00' });
  });

  it('rend visible toute perte excédant les capacités d’absorption', () => {
    const result = classifyLossAbsorption({
      lossAmount: '100.00', cause: 'EXTERNAL_OPERATIONAL_EVENT', irrPolicy: 'NOT_APPLICABLE',
      availableIrr: '0', availablePer: '10', availableDepositorCapital: '20',
    });
    expect(result.unabsorbedLoss).toBe('70.00');
    expect(result.conservationDifference).toBe('0.00');
  });
});
