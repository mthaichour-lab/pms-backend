import type { Pool } from 'pg';

import type {
  AccountingPostingCommand,
  AccountingPostingRepository,
  ApprovedCalculationSnapshot,
} from '../../modules/accounting/application/post-approved-calculation.js';
import type { JournalLineDraft } from '../../modules/accounting/domain/balanced-journal.js';

export class PostgresAccountingPostingRepository implements AccountingPostingRepository {
  constructor(private readonly pool: Pick<Pool, 'connect'>) {}

  async postAtomically(
    command: AccountingPostingCommand,
    buildLines: (snapshot: ApprovedCalculationSnapshot) => readonly JournalLineDraft[],
  ): Promise<{ state: 'POSTED'; journalEntryId: string }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const replay = await client.query<{ resource_id: string; actor_id: string; justification: string }>(
        `SELECT resource_id, actor_id, justification FROM workflow.approval_action
         WHERE idempotency_key = $1 AND action = 'POST_CALCULATION'`, [command.idempotencyKey],
      );
      if (replay.rows[0]) {
        const action = replay.rows[0];
        if (action.resource_id !== command.runId || action.actor_id !== command.actorId ||
          action.justification !== command.justification) {
          throw new Error('Idempotency key was already used for a different posting');
        }
        const journal = await client.query<{ journal_entry_id: string }>(
          `SELECT journal_entry_id::text FROM accounting.journal_entry WHERE run_id = $1::uuid`, [command.runId],
        );
        if (!journal.rows[0]) throw new Error('Posted calculation has no journal entry');
        await client.query('COMMIT');
        return { state: 'POSTED', journalEntryId: journal.rows[0].journal_entry_id };
      }
      const runResult = await client.query<{
        status: string; maker_id: string | null; business_date: string; correlation_id: string;
        distributable_amount: string; currency_code: string; amount_scale: number;
      }>(
        `SELECT r.status, r.maker_id, r.business_date::text, r.correlation_id::text,
                r.distributable_amount::text, r.currency_code, c.fraction_digits AS amount_scale
         FROM calculation.run r JOIN reference.currency_version c ON c.currency_code = r.currency_code
          AND c.valid_from <= r.business_date
          AND (c.valid_until IS NULL OR c.valid_until > r.business_date)
         WHERE r.run_id = $1::uuid FOR UPDATE`, [command.runId],
      );
      const run = runResult.rows[0];
      if (!run) throw new Error('Calculation run not found');
      if (run.status !== 'APPROVED') throw new Error(`Calculation cannot be posted from ${run.status}`);
      if (run.maker_id === command.actorId) throw new Error('Maker cannot post their own calculation');
      const allocationResult = await client.query<{
        participant_id: string; amount: string; currency_code: string;
      }>(
        `SELECT participant_id::text, amount::text, currency_code
         FROM calculation.allocation_result WHERE run_id = $1::uuid ORDER BY participant_id`, [command.runId],
      );
      const lines = buildLines({
        distributableAmount: run.distributable_amount, currency: run.currency_code,
        amountScale: run.amount_scale,
        allocations: allocationResult.rows.map((row) => ({
          participantId: row.participant_id, amount: row.amount, currency: row.currency_code,
        })),
      });
      const journal = await client.query<{ journal_entry_id: string }>(
        `INSERT INTO accounting.journal_entry
           (run_id, business_date, entry_kind, status, correlation_id, created_by)
         VALUES ($1::uuid, $2::date, 'PROFIT_ALLOCATION', 'DRAFT', $3::uuid, $4)
         RETURNING journal_entry_id::text`,
        [command.runId, run.business_date, run.correlation_id, command.actorId],
      );
      const journalEntryId = journal.rows[0]?.journal_entry_id;
      if (!journalEntryId) throw new Error('Journal entry creation returned no identifier');
      for (const [index, line] of lines.entries()) {
        await client.query(
          `INSERT INTO accounting.journal_line
             (journal_entry_id, line_number, account_code, currency_code, debit, credit, participant_id)
           VALUES ($1::uuid, $2, $3, $4, $5::numeric, $6::numeric, $7::uuid)`,
          [journalEntryId, index + 1, line.accountCode, line.currency, line.debit, line.credit,
            line.accountCode.startsWith('INVESTMENT:') ? line.accountCode.slice('INVESTMENT:'.length) : null],
        );
      }
      await client.query(
        `UPDATE accounting.journal_entry SET status = 'POSTED', posted_at = clock_timestamp()
         WHERE journal_entry_id = $1::uuid AND status = 'DRAFT'`, [journalEntryId],
      );
      const posted = await client.query(
        `UPDATE calculation.run SET status = 'POSTED' WHERE run_id = $1::uuid AND status = 'APPROVED'`,
        [command.runId],
      );
      if (posted.rowCount !== 1) throw new Error('Calculation run was concurrently modified');
      await client.query(
        `INSERT INTO workflow.approval_action
           (idempotency_key, resource_type, resource_id, action, actor_id, justification, result_state)
         VALUES ($1, 'CalculationRun', $2, 'POST_CALCULATION', $3, $4, 'POSTED')`,
        [command.idempotencyKey, command.runId, command.actorId, command.justification],
      );
      await client.query(
        `INSERT INTO integration.outbox_event
          (event_id, aggregate_type, aggregate_id, event_type, schema_version, correlation_id, payload, occurred_at)
         VALUES (gen_random_uuid(), 'JournalEntry', $1, 'CalculationPosted.v1', 1,
                 gen_random_uuid(), jsonb_build_object('runId', $2, 'journalEntryId', $1,
                   'idempotencyKey', $3), clock_timestamp())`,
        [journalEntryId, command.runId, command.idempotencyKey],
      );
      await client.query('COMMIT');
      return { state: 'POSTED', journalEntryId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
