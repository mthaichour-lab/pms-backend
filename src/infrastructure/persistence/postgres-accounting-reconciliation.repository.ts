import type { Pool } from 'pg';

import type {
  ReconciliationCommand,
  ReconciliationRepository,
} from '../../modules/accounting/application/reconcile-general-ledger.js';
import { reconcileAmounts } from '../../modules/accounting/domain/reconciliation.js';
import { discrepancyDeadline } from '../../modules/accounting/domain/reconciliation-discrepancy.js';

interface ReconciliationRow {
  reconciliation_id: string;
  subledger_amount: string;
  general_ledger_amount: string;
  difference: string;
  source_reference: string;
  state: 'MATCHED' | 'VARIANCE';
}

interface DiscrepancyRow {
  discrepancy_id: string;
  amount: string;
  severity: string;
  owner_id: string;
  cause: string;
  corrective_action: string;
  resolution_due_at: Date | string;
  detected_at: Date | string;
}

export class PostgresAccountingReconciliationRepository implements ReconciliationRepository {
  constructor(private readonly pool: Pick<Pool, 'connect'>) {}

  async reconcileAtomically(command: ReconciliationCommand, compare: typeof reconcileAmounts) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`accounting-reconciliation:${command.businessDate}:${command.currency}:${command.sourceChecksumSha256}`],
      );
      const totals = await client.query<{ subledger_amount: string; amount_scale: number }>(
        `SELECT COALESCE(SUM(l.credit - l.debit), 0)::text AS subledger_amount,
                c.fraction_digits AS amount_scale
         FROM reference.currency_version c
         LEFT JOIN accounting.journal_entry j
           ON j.status = 'POSTED' AND j.business_date <= $1::date
         LEFT JOIN accounting.journal_line l ON l.journal_entry_id = j.journal_entry_id
           AND l.currency_code = c.currency_code AND l.account_code LIKE 'INVESTMENT:%'
         WHERE c.currency_code = $2
           AND c.valid_from <= $1::date
           AND (c.valid_until IS NULL OR c.valid_until > $1::date)
         GROUP BY c.fraction_digits`,
        [command.businessDate, command.currency],
      );
      const total = totals.rows[0];
      if (!total) throw new Error('Currency not effective on reconciliation business date');

      const calculated = compare(
        total.subledger_amount, command.generalLedgerAmount, command.currency, total.amount_scale,
      );
      const inserted = await client.query<ReconciliationRow>(
        `INSERT INTO accounting.reconciliation
          (business_date, currency_code, subledger_amount, general_ledger_amount, difference,
           source_reference, source_checksum_sha256, state, created_by)
         VALUES ($1::date, $2, $3::numeric, $4::numeric, $5::numeric, $6, $7, $8, $9)
         ON CONFLICT (business_date, currency_code, source_checksum_sha256) DO NOTHING
         RETURNING reconciliation_id::text, subledger_amount::text, general_ledger_amount::text,
                   difference::text, source_reference, state`,
        [command.businessDate, command.currency, total.subledger_amount, command.generalLedgerAmount,
          calculated.difference, command.sourceReference, command.sourceChecksumSha256,
          calculated.state, command.actorId],
      );
      const wasCreated = inserted.rows.length > 0;
      let reconciliation = inserted.rows[0];
      if (!reconciliation) {
        const replay = await client.query<ReconciliationRow>(
          `SELECT reconciliation_id::text, subledger_amount::text, general_ledger_amount::text,
                  difference::text, source_reference, state
           FROM accounting.reconciliation
           WHERE business_date = $1::date AND currency_code = $2 AND source_checksum_sha256 = $3`,
          [command.businessDate, command.currency, command.sourceChecksumSha256],
        );
        reconciliation = replay.rows[0];
        if (!reconciliation) throw new Error('Concurrent reconciliation result is unavailable');
        this.assertReplayMatches(reconciliation, command, total.amount_scale, compare);
      }

      const persisted = compare(
        reconciliation.subledger_amount, reconciliation.general_ledger_amount,
        command.currency, total.amount_scale,
      );
      if (persisted.state !== reconciliation.state || persisted.difference !== normalizeStoredAmount(
        reconciliation.difference, command.currency, total.amount_scale,
      )) {
        throw new Error('Persisted reconciliation result is inconsistent');
      }

      let discrepancyId: string | undefined;
      if (reconciliation.state === 'VARIANCE') {
        if (!command.discrepancy) {
          throw new Error('Variance requires documented discrepancy ownership, cause and corrective action');
        }
        const dueAt = discrepancyDeadline(command.discrepancy.detectedAt, command.discrepancy.severity);
        const created = await client.query<{ discrepancy_id: string }>(
          `INSERT INTO accounting.reconciliation_discrepancy
             (reconciliation_id, amount, currency_code, severity, owner_id, cause,
              corrective_action, status, resolution_due_at, detected_at)
           VALUES ($1::uuid, $2::numeric, $3, $4, $5, $6, $7, 'DETECTED', $8::timestamptz, $9::timestamptz)
           ON CONFLICT (reconciliation_id) DO NOTHING
           RETURNING discrepancy_id::text`,
          [reconciliation.reconciliation_id, persisted.difference, command.currency,
            command.discrepancy.severity, command.discrepancy.ownerId, command.discrepancy.cause,
            command.discrepancy.correctiveAction, dueAt, command.discrepancy.detectedAt],
        );
        discrepancyId = created.rows[0]?.discrepancy_id;
        if (!discrepancyId) {
          const existing = await client.query<DiscrepancyRow>(
            `SELECT discrepancy_id::text, amount::text, severity, owner_id, cause,
                    corrective_action, resolution_due_at, detected_at
             FROM accounting.reconciliation_discrepancy WHERE reconciliation_id = $1::uuid`,
            [reconciliation.reconciliation_id],
          );
          const discrepancy = existing.rows[0];
          if (!discrepancy) throw new Error('Concurrent reconciliation discrepancy is unavailable');
          this.assertDiscrepancyReplayMatches(
            discrepancy, command, persisted.difference, dueAt, total.amount_scale, compare,
          );
          discrepancyId = discrepancy.discrepancy_id;
        }
      } else if (command.discrepancy) {
        throw new Error('Matched reconciliation cannot include discrepancy details');
      }

      if (wasCreated) {
        await client.query(
          `INSERT INTO integration.outbox_event
             (event_id, aggregate_type, aggregate_id, event_type, schema_version,
              correlation_id, payload, occurred_at)
             VALUES (gen_random_uuid(), 'AccountingReconciliation', $1,
             'AccountingReconciliationCompleted.v1', 1, $2::uuid,
             jsonb_build_object(
               'reconciliationId', $1, 'businessDate', $3, 'currency', $4,
               'state', $5, 'difference', $6, 'sourceChecksumSha256', $7,
               'discrepancyId', $8
             ), clock_timestamp())`,
          [reconciliation.reconciliation_id, command.correlationId ?? reconciliation.reconciliation_id, command.businessDate, command.currency,
            persisted.state, persisted.difference, command.sourceChecksumSha256,
            discrepancyId ?? null],
        );
      }

      await client.query('COMMIT');
      return {
        reconciliationId: reconciliation.reconciliation_id,
        state: persisted.state,
        difference: persisted.difference,
        ...(discrepancyId ? { discrepancyId } : {}),
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private assertReplayMatches(
    persisted: ReconciliationRow,
    command: ReconciliationCommand,
    scale: number,
    compare: typeof reconcileAmounts,
  ): void {
    const generalLedgerMatches = compare(
      persisted.general_ledger_amount, command.generalLedgerAmount, command.currency, scale,
    ).state === 'MATCHED';
    if (!generalLedgerMatches || persisted.source_reference !== command.sourceReference) {
      throw new Error('Reconciliation replay payload differs');
    }
  }

  private assertDiscrepancyReplayMatches(
    persisted: DiscrepancyRow,
    command: ReconciliationCommand,
    difference: string,
    dueAt: string,
    scale: number,
    compare: typeof reconcileAmounts,
  ): void {
    const discrepancy = command.discrepancy!;
    const amountMatches = compare(
      persisted.amount, difference, command.currency, scale,
    ).state === 'MATCHED';
    if (!amountMatches || persisted.severity !== discrepancy.severity ||
      persisted.owner_id !== discrepancy.ownerId || persisted.cause !== discrepancy.cause ||
      persisted.corrective_action !== discrepancy.correctiveAction ||
      toIsoString(persisted.detected_at) !== discrepancy.detectedAt ||
      toIsoString(persisted.resolution_due_at) !== dueAt) {
      throw new Error('Reconciliation discrepancy replay payload differs');
    }
  }
}

function normalizeStoredAmount(amount: string, currency: string, scale: number): string {
  return reconcileAmounts(amount, '0', currency, scale).difference;
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
