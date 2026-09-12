import { describe, expect, it } from 'vitest';

import { allocationJournalLines, assertBalancedJournal, reverseJournalLines } from '../../../src/modules/accounting/domain/balanced-journal.js';

describe('balanced journal', () => {
  it('generates a balanced participant liability journal for profit', () => {
    const lines = allocationJournalLines([
      { participantId: 'a', amount: '2.50', currency: 'DZD' },
      { participantId: 'b', amount: '7.50', currency: 'DZD' },
    ], '10.00', 'DZD', 2);
    expect(lines).toHaveLength(3);
    expect(() => assertBalancedJournal(lines, 2)).not.toThrow();
  });

  it('creates a balanced immutable reversal by swapping each side', () => {
    const source = [
      { accountCode: 'POOL:DISTRIBUTABLE', currency: 'DZD', debit: '10.00', credit: '0', participantId: null },
      { accountCode: 'INVESTMENT:a', currency: 'DZD', debit: '0', credit: '10.00', participantId: 'a' },
    ];
    const reversed = reverseJournalLines(source, 2);
    expect(reversed).toEqual([
      { ...source[0], debit: '0', credit: '10.00' },
      { ...source[1], debit: '10.00', credit: '0' },
    ]);
    expect(source[0]?.debit).toBe('10.00');
  });

  it('rejects an unbalanced or two-sided journal line', () => {
    expect(() => assertBalancedJournal([
      { accountCode: 'AA', currency: 'DZD', debit: '1.00', credit: '0' },
      { accountCode: 'BB', currency: 'DZD', debit: '0', credit: '0.99' },
    ], 2)).toThrow('not balanced');
  });
});
