import { reverseJournalLines, type JournalLineDraft } from '../domain/balanced-journal.js';

export interface JournalReversalCommand {
  journalEntryId: string;
  reversalBusinessDate: string;
  actorId: string;
  justification: string;
  idempotencyKey: string;
}

export interface PostedJournalSnapshot {
  amountScale: number;
  lines: readonly JournalLineDraft[];
}

export interface AccountingReversalRepository {
  reverseAtomically(
    command: JournalReversalCommand,
    buildLines: (snapshot: PostedJournalSnapshot) => readonly JournalLineDraft[],
  ): Promise<{ state: 'POSTED'; reversalJournalEntryId: string }>;
}

export class ReversePostedJournal {
  constructor(private readonly repository: AccountingReversalRepository) {}

  execute(command: JournalReversalCommand) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(command.journalEntryId)) {
      throw new TypeError('Journal entry identifier must be a UUID');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(command.reversalBusinessDate) ||
      Number.isNaN(Date.parse(`${command.reversalBusinessDate}T00:00:00Z`))) {
      throw new TypeError('Reversal business date must use YYYY-MM-DD');
    }
    if (!command.actorId.trim()) throw new TypeError('Reversal actor is required');
    if (command.justification.trim().length < 10) throw new TypeError('Reversal justification must contain at least 10 characters');
    if (command.idempotencyKey.length < 16 || command.idempotencyKey.length > 128) {
      throw new TypeError('Reversal idempotency key must contain between 16 and 128 characters');
    }
    return this.repository.reverseAtomically(
      { ...command, justification: command.justification.trim() },
      (snapshot) => reverseJournalLines(snapshot.lines, snapshot.amountScale),
    );
  }
}
