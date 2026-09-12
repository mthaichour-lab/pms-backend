import type { Pool } from 'pg';
import type { ReconciliationCommand, ReconciliationRepository } from '../../modules/accounting/application/reconcile-general-ledger.js';
import { reconcileAmounts } from '../../modules/accounting/domain/reconciliation.js';
import { discrepancyDeadline } from '../../modules/accounting/domain/reconciliation-discrepancy.js';

export class PostgresAccountingReconciliationRepository implements ReconciliationRepository {
  constructor(private readonly pool: Pick<Pool, 'connect'>) {}
  async reconcileAtomically(command: ReconciliationCommand, compare: typeof reconcileAmounts) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
      const totals = await client.query<{ subledger_amount: string; amount_scale: number }>(
        `SELECT COALESCE(SUM(l.credit - l.debit), 0)::text AS subledger_amount, c.amount_scale
         FROM reference.currency c LEFT JOIN accounting.journal_entry j
           ON j.status = 'POSTED' AND j.business_date <= $1::date
         LEFT JOIN accounting.journal_line l ON l.journal_entry_id = j.journal_entry_id
           AND l.currency_code = c.currency_code AND l.account_code LIKE 'INVESTMENT:%'
         WHERE c.currency_code = $2 AND (l.journal_entry_id IS NULL OR l.account_code LIKE 'INVESTMENT:%')
         GROUP BY c.amount_scale`, [command.businessDate, command.currency],
      );
      const total = totals.rows[0];
      if (!total) throw new Error('Currency not found');
      const result = compare(total.subledger_amount, command.generalLedgerAmount, command.currency, total.amount_scale);
      const inserted = await client.query<{ reconciliation_id: string }>(
        `INSERT INTO accounting.reconciliation
          (business_date, currency_code, subledger_amount, general_ledger_amount, difference,
           source_reference, source_checksum_sha256, state, created_by)
         VALUES ($1::date, $2, $3::numeric, $4::numeric, $5::numeric, $6, $7, $8, $9)
         ON CONFLICT (business_date, currency_code, source_checksum_sha256) DO NOTHING
         RETURNING reconciliation_id::text`,
        [command.businessDate, command.currency, total.subledger_amount, command.generalLedgerAmount,
          result.difference, command.sourceReference, command.sourceChecksumSha256, result.state, command.actorId],
      );
      let reconciliationId = inserted.rows[0]?.reconciliation_id;
      if (!reconciliationId) {
        const replay = await client.query<{ reconciliation_id: string }>(
          `SELECT reconciliation_id::text
           FROM accounting.reconciliation WHERE business_date = $1::date AND currency_code = $2
             AND source_checksum_sha256 = $3 AND general_ledger_amount = $4::numeric AND source_reference = $5`,
          [command.businessDate, command.currency, command.sourceChecksumSha256,
            command.generalLedgerAmount, command.sourceReference],
        );
        if (!replay.rows[0]) throw new Error('Reconciliation replay payload differs');
        reconciliationId = replay.rows[0].reconciliation_id;
      }
      let discrepancyId: string | undefined;
      if (result.state === 'VARIANCE') {
        if (!command.discrepancy) throw new Error('Variance requires documented discrepancy ownership, cause and corrective action');
        const existingDiscrepancy=await client.query<{discrepancy_id:string}>(`SELECT discrepancy_id::text FROM accounting.reconciliation_discrepancy WHERE reconciliation_id=$1::uuid`,[reconciliationId]);
        discrepancyId=existingDiscrepancy.rows[0]?.discrepancy_id;
        if(!discrepancyId){
          const created=await client.query<{discrepancy_id:string}>(`INSERT INTO accounting.reconciliation_discrepancy(reconciliation_id,amount,currency_code,severity,owner_id,cause,corrective_action,status,resolution_due_at,detected_at)VALUES($1::uuid,$2::numeric,$3,$4,$5,$6,$7,'DETECTED',$8::timestamptz,$9::timestamptz)RETURNING discrepancy_id::text`,[reconciliationId,result.difference,command.currency,command.discrepancy.severity,command.discrepancy.ownerId,command.discrepancy.cause,command.discrepancy.correctiveAction,discrepancyDeadline(command.discrepancy.detectedAt,command.discrepancy.severity),command.discrepancy.detectedAt]);
          discrepancyId=created.rows[0]!.discrepancy_id;
        }
      }
      await client.query('COMMIT');
      return { reconciliationId, ...result, ...(discrepancyId ? { discrepancyId } : {}) };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
}
