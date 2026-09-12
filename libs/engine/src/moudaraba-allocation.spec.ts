import { describe, expect, it } from 'vitest';
import { allocateMoudarabaProfit } from './moudaraba-allocation.js';

const participants = [
  { accountId: 'ACC-A', categoryId: 'SAVINGS', weightedParticipationBase: '100' },
  { accountId: 'ACC-B', categoryId: 'SAVINGS', weightedParticipationBase: '300' },
  { accountId: 'ACC-C', categoryId: 'TERM', weightedParticipationBase: '600' },
] as const;

describe('allocateMoudarabaProfit', () => {
  it('Méthode 2 alloue selon les bases pondérées sans aucun reliquat', () => {
    const result = allocateMoudarabaProfit({
      profitAfterPer: '100.01',
      investorNisba: '0.7',
      bankNisba: '0.3',
      irrAllocation: '7.00',
      method: 'WEIGHTED_AVERAGE',
      participants,
    });

    expect(result.bankShare).toBe('30.00');
    expect(result.investorShareBeforeIrr).toBe('70.01');
    expect(result.investorShareAfterIrr).toBe('63.01');
    expect(result.accountAllocations.map((entry) => entry.allocatedProfit)).toEqual(['6.30', '18.90', '37.81']);
    expect(result.unallocatedRemainder).toBe('0.00');
  });

  it('Méthode 1 applique d’abord la clé fixe de catégorie', () => {
    const result = allocateMoudarabaProfit({
      profitAfterPer: '100.00',
      investorNisba: '0.8',
      bankNisba: '0.2',
      irrAllocation: '0',
      method: 'FIXED_CATEGORY_KEY',
      participants,
      categoryKeys: [
        { categoryId: 'SAVINGS', allocationKey: '0.25' },
        { categoryId: 'TERM', allocationKey: '0.75' },
      ],
    });

    expect(result.accountAllocations.map((entry) => entry.allocatedProfit)).toEqual(['5.00', '15.00', '60.00']);
    expect(result.unallocatedRemainder).toBe('0.00');
  });

  it('répartit les centimes résiduels de manière stable par identifiant', () => {
    const input = {
      profitAfterPer: '0.05',
      investorNisba: '1',
      bankNisba: '0',
      irrAllocation: '0',
      method: 'WEIGHTED_AVERAGE' as const,
      participants: [
        { accountId: 'ACC-C', categoryId: 'X', weightedParticipationBase: '1' },
        { accountId: 'ACC-A', categoryId: 'X', weightedParticipationBase: '1' },
        { accountId: 'ACC-B', categoryId: 'X', weightedParticipationBase: '1' },
      ],
    };

    const first = allocateMoudarabaProfit(input);
    const second = allocateMoudarabaProfit(input);
    expect(first).toEqual(second);
    expect(Object.fromEntries(first.accountAllocations.map((entry) => [entry.accountId, entry.allocatedProfit]))).toEqual({
      'ACC-C': '0.01',
      'ACC-A': '0.02',
      'ACC-B': '0.02',
    });
  });

  it('bloque une Nisba qui ne totalise pas exactement 100 %', () => {
    expect(() => allocateMoudarabaProfit({
      profitAfterPer: '100',
      investorNisba: '0.7',
      bankNisba: '0.29',
      irrAllocation: '0',
      method: 'WEIGHTED_AVERAGE',
      participants,
    })).toThrow('must total exactly 1');
  });
});
