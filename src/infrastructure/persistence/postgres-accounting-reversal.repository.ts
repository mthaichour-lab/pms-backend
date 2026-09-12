import type { Pool } from 'pg';

import type {
  AccountingReversalRepository, JournalReversalCommand, PostedJournalSnapshot,
} from '../../modules/accounting/application/reverse-posted-journal.js';
import type { JournalLineDraft } from '../../modules/accounting/domain/balanced-journal.js';

export class PostgresAccountingReversalRepository implements AccountingReversalRepository {
  constructor(private readonly pool: Pick<Pool, 'connect'>) {}

  async reverseAtomically(
    command: JournalReversalCommand,
    buildLines: (snapshot: PostedJournalSnapshot) => readonly JournalLineDraft[],
  ): Promise<{ state: 'POSTED'; reversalJournalEntryId: string }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const replay = await client.query<{ resource_id: string; actor_id: string; justification: string }>(
        `SELECT resource_id, actor_id, justification FROM workflow.approval_action
         WHERE idempotency_key = $1 AND action = 'REVERSE_JOURNAL'`, [command.idempotencyKey],
      );
      if (replay.rows[0]) {
        const action = replay.rows[0];
        if (action.resource_id !== command.journalEntryId || action.actor_id !== command.actorId ||
          action.justification !== command.justification) {
          throw new Error('Idempotency key was already used for a different reversal');
        }
        const existing = await client.query<{ journal_entry_id: string; business_date: string }>(
          `SELECT journal_entry_id::text, business_date::text FROM accounting.journal_entry
           WHERE reversal_of = $1::uuid`, [command.journalEntryId],
        );
        if (!existing.rows[0] || existing.rows[0].business_date !== command.reversalBusinessDate) {
          throw new Error('Reversal replay does not match the requested business date');
        }
        await client.query('COMMIT');
        return { state: 'POSTED', reversalJournalEntryId: existing.rows[0].journal_entry_id };
      }

      const originalResult = await client.query<{
        status: string; entry_kind: string; correlation_id: string; created_by: string; amount_scale: number;
      }>(
        `SELECT j.status, j.entry_kind, j.correlation_id::text, j.created_by, c.amount_scale
         FROM accounting.journal_entry j
         JOIN reference.currency c ON c.currency_code = (
           SELECT currency_code FROM accounting.journal_line
           WHERE journal_entry_id = j.journal_entry_id ORDER BY line_number LIMIT 1
         )
         WHERE j.journal_entry_id = $1::uuid FOR UPDATE OF j`, [command.journalEntryId],
      );
      const original = originalResult.rows[0];
      if (!original) throw new Error('Journal entry not found');
      if (original.status !== 'POSTED') throw new Error('Only a posted journal entry can be reversed');
      if (original.entry_kind === 'REVERSAL') throw new Error('A reversal cannot itself be reversed');
      if (original.created_by === command.actorId) throw new Error('Journal creator cannot reverse their own entry');

      const sourceLines = await client.query<JournalLineDraft>(
        `SELECT account_code AS "accountCode", currency_code AS currency,
                debit::text, credit::text, participant_id::text AS "participantId"
         FROM accounting.journal_line WHERE journal_entry_id = $1::uuid ORDER BY line_number`,
        [command.journalEntryId],
      );
      const lines = buildLines({ amountScale: original.amount_scale, lines: sourceLines.rows });
      const reversal = await client.query<{ journal_entry_id: string }>(
        `INSERT INTO accounting.journal_entry
           (business_date, entry_kind, status, reversal_of, correlation_id, created_by)
         VALUES ($1::date, 'REVERSAL', 'DRAFT', $2::uuid, $3::uuid, $4)
         RETURNING journal_entry_id::text`,
        [command.reversalBusinessDate, command.journalEntryId, original.correlation_id, command.actorId],
      );
      const reversalJournalEntryId = reversal.rows[0]?.journal_entry_id;
      if (!reversalJournalEntryId) throw new Error('Reversal creation returned no identifier');
      for (const [index, line] of lines.entries()) {
        await client.query(
          `INSERT INTO accounting.journal_line
             (journal_entry_id, line_number, account_code, currency_code, debit, credit, participant_id)
           VALUES ($1::uuid, $2, $3, $4, $5::numeric, $6::numeric, $7::uuid)`,
          [reversalJournalEntryId, index + 1, line.accountCode, line.currency,
            line.debit, line.credit, line.participantId ?? null],
        );
      }
      await client.query(
        `UPDATE accounting.journal_entry SET status = 'POSTED', posted_at = clock_timestamp()
         WHERE journal_entry_id = $1::uuid AND status = 'DRAFT'`, [reversalJournalEntryId],
      );
      await client.query(
        `INSERT INTO workflow.approval_action
           (idempotency_key, resource_type, resource_id, action, actor_id, justification, result_state)
         VALUES ($1, 'JournalEntry', $2, 'REVERSE_JOURNAL', $3, $4, 'POSTED')`,
        [command.idempotencyKey, command.journalEntryId, command.actorId, command.justification],
      );
      await client.query('COMMIT');
      return { state: 'POSTED', reversalJournalEntryId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
