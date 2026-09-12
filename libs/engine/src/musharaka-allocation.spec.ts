import { describe, expect, it } from 'vitest';
import { allocateMusharakaResult, buildMoutanaqissaSchedule } from './musharaka-allocation.js';

describe('allocateMusharakaResult', () => {
  it('partage le profit selon le ratio négocié', () => {
    const result = allocateMusharakaResult({
      result: '100.01', bankCapital: '400', partnerCapital: '600', bankProfitRatio: '0.3', partnerProfitRatio: '0.7', passivePartner: 'NONE',
    });
    expect(result).toMatchObject({ bankAllocation: '30.00', partnerAllocation: '70.01', appliedRule: 'NEGOTIATED_PROFIT_RATIO', conservationDifference: '0.00' });
  });

  it('répartit une perte ordinaire strictement au prorata du capital', () => {
    const result = allocateMusharakaResult({
      result: '-10.00', bankCapital: '400', partnerCapital: '600', bankProfitRatio: '0.3', partnerProfitRatio: '0.7', passivePartner: 'NONE',
      lossCause: 'ORDINARY_MARKET_LOSS',
    });
    expect(result).toMatchObject({ bankAllocation: '-4.00', partnerAllocation: '-6.00', appliedRule: 'CAPITAL_LOSS_RATIO' });
  });

  it('fait prévaloir la causalité et impute intégralement la perte à la banque', () => {
    const result = allocateMusharakaResult({
      result: '-10.00', bankCapital: '400', partnerCapital: '600', bankProfitRatio: '0.3', partnerProfitRatio: '0.7', passivePartner: 'NONE',
      lossCause: 'MANDATE_VIOLATION',
    });
    expect(result).toMatchObject({ bankAllocation: '-10.00', partnerAllocation: '0.00', appliedRule: 'CAUSAL_BANK_LIABILITY' });
  });

  it('bloque un ratio du partenaire passif supérieur à sa quote-part de capital', () => {
    expect(() => allocateMusharakaResult({
      result: '10', bankCapital: '800', partnerCapital: '200', bankProfitRatio: '0.6', partnerProfitRatio: '0.4', passivePartner: 'PARTNER',
    })).toThrow('Passive partner profit ratio cannot exceed its capital ratio');
  });
});

describe('buildMoutanaqissaSchedule', () => {
  it('éteint la part bancaire à échéance en conservant 100 % des ratios', () => {
    const result = buildMoutanaqissaSchedule({
      bankCapital: '600', partnerCapital: '400', maturityReached: true,
      purchases: [
        { period: 1, bankCapitalPurchased: '100' },
        { period: 2, bankCapitalPurchased: '200' },
        { period: 3, bankCapitalPurchased: '300' },
      ],
    });
    expect(result.finalBankCapital).toBe('0.000000000000');
    expect(result.finalPartnerCapital).toBe('1000.000000000000');
    expect(result.fullyAcquired).toBe(true);
    expect(result.periods.every((period) => period.ratioTotal === '1.000000000000')).toBe(true);
  });

  it('bloque une échéance laissant une part bancaire résiduelle', () => {
    expect(() => buildMoutanaqissaSchedule({
      bankCapital: '600', partnerCapital: '400', maturityReached: true,
      purchases: [{ period: 1, bankCapitalPurchased: '500' }],
    })).toThrow('fully acquired at maturity');
  });
});
