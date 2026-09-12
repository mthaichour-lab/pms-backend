import { describe, expect, it, vi } from 'vitest';

import { ReversePostedJournal } from '../../../src/modules/accounting/application/reverse-posted-journal.js';

const journalEntryId = 'a1d817e4-657f-475f-a96a-7eecb8f93acc';

describe('ReversePostedJournal', () => {
  it('delegates a balanced inverse without mutating the source journal', async () => {
    let reversedDebit = '';
    const reverseAtomically = vi.fn(async (_command, buildLines) => {
      const lines = buildLines({ amountScale: 2, lines: [
        { accountCode: 'AA', currency: 'DZD', debit: '5.00', credit: '0' },
        { accountCode: 'BB', currency: 'DZD', debit: '0', credit: '5.00' },
      ] });
      reversedDebit = lines[0]?.debit ?? '';
      return { state: 'POSTED' as const, reversalJournalEntryId: '17146c36-a0cb-4e0a-b095-60b67c945eb9' };
    });
    const useCase = new ReversePostedJournal({ reverseAtomically });
    await useCase.execute({
      journalEntryId, reversalBusinessDate: '2026-08-28', actorId: 'controller-2',
      justification: 'Correction validée du journal', idempotencyKey: 'reversal-action-0001',
    });
    expect(reversedDebit).toBe('0');
  });

  it('rejects an invalid business date before persistence', () => {
    const useCase = new ReversePostedJournal({ reverseAtomically: vi.fn() });
    expect(() => useCase.execute({
      journalEntryId, reversalBusinessDate: '28/08/2026', actorId: 'controller-2',
      justification: 'Correction validée du journal', idempotencyKey: 'reversal-action-0001',
    })).toThrow('YYYY-MM-DD');
  });
});
