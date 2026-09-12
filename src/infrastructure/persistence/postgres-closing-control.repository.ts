import { createHash } from 'node:crypto';
import type { Pool } from 'pg';

import type {
  ClosingControlRepository,
  ClosingRequest,
} from '../../modules/closing-workflow/application/evaluate-closing-request.js';
import type { ClosingControlCounts } from '../../modules/closing-workflow/domain/closing-controls.js';

export class PostgresClosingControlRepository implements ClosingControlRepository {
  constructor(private readonly pool: Pick<Pool, 'connect'>) {}

  async evaluateAndRecord(
    request: ClosingRequest,
    decide: (counts: ClosingControlCounts) => { passed: boolean; blockers: readonly string[] },
  ): Promise<{ state: 'CONTROLS_PASSED' | 'BLOCKED'; blockers: readonly string[] }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`pms.closing.${request.businessDate}`]);
      await client.query(
        `INSERT INTO workflow.closing_period
           (closing_id, business_date, requested_by, correlation_id, state)
         VALUES ($1::uuid, $2::date, $3, $4::uuid, 'REQUESTED')
         ON CONFLICT (closing_id) DO NOTHING`,
        [request.closingId, request.businessDate, request.requestedBy, request.correlationId],
      );
      const persisted = await client.query<{
        business_date: string; requested_by: string; correlation_id: string;
      }>(
        `SELECT business_date::text, requested_by, correlation_id::text
         FROM workflow.closing_period WHERE closing_id = $1::uuid FOR UPDATE`, [request.closingId],
      );
      const existing = persisted.rows[0];
      if (!existing || existing.business_date !== request.businessDate ||
        existing.requested_by !== request.requestedBy || existing.correlation_id !== request.correlationId) {
        throw new Error('Closing identifier conflicts with a different request');
      }
      const controls = await client.query<{
        pending_cbs: string; failed_cbs: string; unapproved_runs: string; approved_runs: string;
        missing_reconciliations: string; open_discrepancies: string;
      }>(
        `SELECT
          (SELECT count(*) FROM integration.cbs_batch WHERE business_date = $1::date
            AND state NOT IN ('PUBLISHED', 'REJECTED', 'QUARANTINED', 'FAILED', 'CANCELLED'))::text AS pending_cbs,
          (SELECT count(*) FROM integration.cbs_batch WHERE business_date = $1::date
            AND state IN ('REJECTED', 'QUARANTINED', 'FAILED'))::text AS failed_cbs,
          (SELECT count(*) FROM calculation.run WHERE business_date = $1::date
            AND status NOT IN ('APPROVED', 'POSTED', 'ARCHIVED'))::text AS unapproved_runs,
          (SELECT count(*) FROM calculation.run WHERE business_date = $1::date
            AND status IN ('APPROVED', 'POSTED', 'ARCHIVED'))::text AS approved_runs,
          (SELECT count(*) FROM accounting.reconciliation_control control
            WHERE control.enabled AND NOT EXISTS (SELECT 1 FROM accounting.reconciliation reconciliation
              WHERE reconciliation.business_date=$1::date AND reconciliation.reconciliation_type=control.reconciliation_type))::text AS missing_reconciliations,
          (SELECT count(*) FROM accounting.reconciliation_discrepancy discrepancy
            JOIN accounting.reconciliation reconciliation USING(reconciliation_id)
            WHERE reconciliation.business_date=$1::date AND discrepancy.status NOT IN('CLOSED','ACCEPTED_RISK'))::text AS open_discrepancies`,
        [request.businessDate],
      );
      const row = controls.rows[0];
      if (!row) throw new Error('Closing controls returned no result');
      const counts: ClosingControlCounts = {
        pendingCbsBatches: Number(row.pending_cbs), failedCbsBatches: Number(row.failed_cbs),
        unapprovedCalculationRuns: Number(row.unapproved_runs), approvedCalculationRuns: Number(row.approved_runs),
        missingRequiredReconciliations: Number(row.missing_reconciliations),
        unresolvedReconciliationDiscrepancies: Number(row.open_discrepancies),
      };
      const decision = decide(counts);
      const state = decision.passed ? 'CONTROLS_PASSED' : 'BLOCKED';
      const checksum = createHash('sha256').update(JSON.stringify(counts)).digest('hex');
      const updated = await client.query(
        `UPDATE workflow.closing_period SET state = $2, blockers = $3::jsonb,
           input_checksum_sha256 = $4, controlled_at = clock_timestamp()
         WHERE closing_id = $1::uuid AND state IN ('REQUESTED', 'BLOCKED', 'CONTROLS_PASSED')`,
        [request.closingId, state, JSON.stringify(decision.blockers), checksum],
      );
      if (updated.rowCount !== 1) throw new Error('Closing request cannot be controlled from its current state');
      await client.query('COMMIT');
      return { state, blockers: decision.blockers };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
