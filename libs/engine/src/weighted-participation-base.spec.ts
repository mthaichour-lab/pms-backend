import { describe, expect, it } from 'vitest';
import { calculateWeightedParticipationBase } from './weighted-participation-base.js';

describe('calculateWeightedParticipationBase', () => {
  it('cumule chaque solde quotidien avec les pondérations et ACTUAL/365', () => {
    const result = calculateWeightedParticipationBase({
      accountId: 'ACC-001',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-03',
      balanceConvention: 'DAILY_BALANCE',
      dayCountConvention: 'ACTUAL_365',
      categoryWeight: '0.8',
      maturityWeight: '0.5',
      observations: [
        { businessDate: '2026-01-01', eligibleBalance: '100.00' },
        { businessDate: '2026-01-02', eligibleBalance: '200.00' },
        { businessDate: '2026-01-03', eligibleBalance: '300.00' },
      ],
    });

    expect(result.weightedAmountDays).toBe('240.000000000000');
    expect(result.weightedParticipationBase).toBe('0.657534246575');
    expect(result.daily.map((day) => day.weightedBasis)).toEqual([
      '40.000000000000',
      '80.000000000000',
      '120.000000000000',
    ]);
  });

  it('applique le minimum journalier sans remplacer les observations par une moyenne mensuelle', () => {
    const result = calculateWeightedParticipationBase({
      accountId: 'ACC-002',
      periodStart: '2026-02-01',
      periodEnd: '2026-02-03',
      balanceConvention: 'MINIMUM_DAILY_BALANCE',
      dayCountConvention: 'ACTUAL_360',
      categoryWeight: '1',
      maturityWeight: '1',
      observations: [
        { businessDate: '2026-02-01', eligibleBalance: '900' },
        { businessDate: '2026-02-02', eligibleBalance: '100' },
        { businessDate: '2026-02-03', eligibleBalance: '500' },
      ],
    });

    expect(result.averageEligibleBasis).toBe('500.000000000000');
    expect(result.minimumEligibleBasis).toBe('100.000000000000');
    expect(result.weightedAmountDays).toBe('300.000000000000');
  });

  it('valorise les unités de participation quotidiennement avec précision décimale', () => {
    const result = calculateWeightedParticipationBase({
      accountId: 'ACC-003',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-02',
      balanceConvention: 'PARTICIPATION_UNITS',
      dayCountConvention: 'ACTUAL_360',
      categoryWeight: '0.333333333333',
      maturityWeight: '0.75',
      observations: [
        { businessDate: '2026-03-01', eligibleBalance: '0', participationUnits: '3', participationUnitValue: '10.01' },
        { businessDate: '2026-03-02', eligibleBalance: '0', participationUnits: '4', participationUnitValue: '10.02' },
      ],
    });

    expect(result.daily[0].eligibleBasis).toBe('30.030000000000');
    expect(result.daily[1].eligibleBasis).toBe('40.080000000000');
    expect(result.weightedAmountDays).toBe('17.527499999982');
  });

  it('refuse une série incomplète ou non consécutive', () => {
    expect(() => calculateWeightedParticipationBase({
      accountId: 'ACC-004',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-03',
      balanceConvention: 'DAILY_BALANCE',
      dayCountConvention: 'ACTUAL_365',
      categoryWeight: '1',
      maturityWeight: '1',
      observations: [
        { businessDate: '2026-04-01', eligibleBalance: '10' },
        { businessDate: '2026-04-03', eligibleBalance: '10' },
      ],
    })).toThrow('Expected 3 daily observations');
  });
});
