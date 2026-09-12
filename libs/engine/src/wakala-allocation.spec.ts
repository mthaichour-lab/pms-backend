import { describe, expect, it } from 'vitest';
import { allocateWakalaProfit } from './wakala-allocation.js';

describe('allocateWakalaProfit', () => {
  it('renonce à une commission sous performance uniquement avec justification approuvée', () => {
    const result = allocateWakalaProfit({
      mandateId: 'WAK-001',
      realizedProfit: '80.00',
      indicativeExpectedProfit: '100.00',
      contractualFee: '10.00',
      feeWaiver: { amount: '6.00', rationale: 'Rapprochement de l’indication commerciale', approved: true },
      surplusPolicy: 'RETURN_TO_MANDANT',
      performanceIncentiveRate: '0',
    });

    expect(result.performance).toBe('UNDERPERFORMANCE');
    expect(result.waivedFee).toBe('6.00');
    expect(result.chargedFee).toBe('4.00');
    expect(result.mandantResult).toBe('76.00');
    expect(result.conservationDifference).toBe('0.00');
  });

  it('calcule l’intéressement uniquement sur le surplus après commission', () => {
    const result = allocateWakalaProfit({
      mandateId: 'WAK-002',
      realizedProfit: '150.00',
      indicativeExpectedProfit: '100.00',
      contractualFee: '10.00',
      surplusPolicy: 'BANK_PERFORMANCE_INCENTIVE',
      performanceIncentiveRate: '0.25',
    });

    expect(result.performanceIncentive).toBe('10.00');
    expect(result.bankTotalRemuneration).toBe('20.00');
    expect(result.mandantResult).toBe('130.00');
  });

  it('restitue tout le surplus au mandant selon la politique contractuelle', () => {
    const result = allocateWakalaProfit({
      mandateId: 'WAK-003',
      realizedProfit: '150.00',
      indicativeExpectedProfit: '100.00',
      contractualFee: '10.00',
      surplusPolicy: 'RETURN_TO_MANDANT',
      performanceIncentiveRate: '0.25',
    });
    expect(result.performanceIncentive).toBe('0.00');
    expect(result.mandantResult).toBe('140.00');
  });

  it('impute une perte au mandant sauf faute établie de la banque', () => {
    const ordinary = allocateWakalaProfit({
      mandateId: 'WAK-004', realizedProfit: '-20.00', indicativeExpectedProfit: '100.00', contractualFee: '5.00',
      surplusPolicy: 'RETURN_TO_MANDANT', performanceIncentiveRate: '0',
    });
    const negligent = allocateWakalaProfit({
      mandateId: 'WAK-005', realizedProfit: '-20.00', indicativeExpectedProfit: '100.00', contractualFee: '5.00',
      surplusPolicy: 'RETURN_TO_MANDANT', performanceIncentiveRate: '0', lossCause: 'MANAGER_FAULT_OR_NEGLIGENCE',
    });
    expect(ordinary).toMatchObject({ mandantResult: '-20.00', lossAttribution: 'MANDANT' });
    expect(negligent).toMatchObject({ mandantResult: '0.00', bankTotalRemuneration: '-20.00', lossAttribution: 'BANK' });
  });

  it('rejette une renonciation non documentée', () => {
    expect(() => allocateWakalaProfit({
      mandateId: 'WAK-006', realizedProfit: '80.00', indicativeExpectedProfit: '100.00', contractualFee: '10.00',
      feeWaiver: { amount: '5.00', rationale: '', approved: true },
      surplusPolicy: 'RETURN_TO_MANDANT', performanceIncentiveRate: '0',
    })).toThrow('approved and documented');
  });
});
