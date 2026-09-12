import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AccountingController } from '../../../apps/api/src/accounting/accounting.controller.js';
import { PostApprovedCalculation } from '../../../src/modules/accounting/application/post-approved-calculation.js';
import { ReversePostedJournal } from '../../../src/modules/accounting/application/reverse-posted-journal.js';
import { ReconcileGeneralLedger } from '../../../src/modules/accounting/application/reconcile-general-ledger.js';

const runId = '17146c36-a0cb-4e0a-b095-60b67c945eb9';
const journalEntryId = 'a1d817e4-657f-475f-a96a-7eecb8f93acc';

describe('AccountingController', () => {
  const reversal = () => new ReversePostedJournal({ reverseAtomically: vi.fn() });
  const reconciliation = () => new ReconcileGeneralLedger({ reconcileAtomically: vi.fn() });
  it('binds the posting actor to the authenticated subject', async () => {
    const postAtomically = vi.fn().mockResolvedValue({
      state: 'POSTED', journalEntryId: 'a1d817e4-657f-475f-a96a-7eecb8f93acc',
    });
    const controller = new AccountingController(new PostApprovedCalculation({ postAtomically }), reversal(), reconciliation());
    await expect(controller.postRun(
      runId, { justification: 'Comptabilisation contrôlée' }, 'posting-action-0001', { sub: 'poster-1' },
    )).resolves.toMatchObject({ state: 'POSTED' });
    expect(postAtomically).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'poster-1' }), expect.any(Function),
    );
  });

  it('rejects a missing idempotency key', async () => {
    const controller = new AccountingController(new PostApprovedCalculation({ postAtomically: vi.fn() }), reversal(), reconciliation());
    await expect(controller.postRun(
      runId, { justification: 'Comptabilisation contrôlée' }, undefined, { sub: 'poster-1' },
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it('binds a reversal to the authenticated subject and business date', async () => {
    const reverseAtomically = vi.fn().mockResolvedValue({
      state: 'POSTED', reversalJournalEntryId: '17146c36-a0cb-4e0a-b095-60b67c945eb9',
    });
    const controller = new AccountingController(
      new PostApprovedCalculation({ postAtomically: vi.fn() }),
      new ReversePostedJournal({ reverseAtomically }),
      reconciliation(),
    );
    await controller.reverseEntry(journalEntryId, {
      justification: 'Correction validée du journal', reversalBusinessDate: '2026-08-28',
    }, 'reversal-action-0001', { sub: 'controller-2' });
    expect(reverseAtomically).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'controller-2', reversalBusinessDate: '2026-08-28' }),
      expect.any(Function),
    );
  });
});
