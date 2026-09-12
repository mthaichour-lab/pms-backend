import { allocationJournalLines, type JournalLineDraft } from '../domain/balanced-journal.js';

export interface AccountingPostingCommand {
  runId: string;
  actorId: string;
  justification: string;
  idempotencyKey: string;
}

export interface ApprovedCalculationSnapshot {
  distributableAmount: string;
  currency: string;
  amountScale: number;
  allocations: readonly { participantId: string; amount: string; currency: string }[];
}

export interface AccountingPostingRepository {
  postAtomically(
    command: AccountingPostingCommand,
    buildLines: (snapshot: ApprovedCalculationSnapshot) => readonly JournalLineDraft[],
  ): Promise<{ state: 'POSTED'; journalEntryId: string }>;
}

export class PostApprovedCalculation {
  constructor(private readonly repository: AccountingPostingRepository) {}

  execute(command: AccountingPostingCommand) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(command.runId)) {
      throw new TypeError('Calculation run identifier must be a UUID');
    }
    if (!command.actorId.trim()) throw new TypeError('Posting actor is required');
    if (command.justification.trim().length < 10) throw new TypeError('Posting justification must contain at least 10 characters');
    if (command.idempotencyKey.length < 16 || command.idempotencyKey.length > 128) {
      throw new TypeError('Posting idempotency key must contain between 16 and 128 characters');
    }
    return this.repository.postAtomically(
      { ...command, justification: command.justification.trim() },
      (snapshot) => allocationJournalLines(
        snapshot.allocations, snapshot.distributableAmount,
        snapshot.currency, snapshot.amountScale,
      ),
    );
  }
}
