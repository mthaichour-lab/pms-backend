import type { Pool, PoolClient } from 'pg';

import type {
  CalculationExecutionRepository,
  CalculationRequest,
  CalculationSnapshot,
  CompletedCalculation,
} from '../../modules/profit-calculation/application/execute-profit-calculation.js';

export class PostgresCalculationExecutionRepository implements CalculationExecutionRepository {
  constructor(private readonly pool: Pick<Pool, 'connect'>) {}

  async executeAtomically(
    request: CalculationRequest,
    calculate: (snapshot: CalculationSnapshot) => CompletedCalculation,
  ): Promise<{ status: 'CALCULATED' | 'ALREADY_CALCULATED'; outputChecksumSha256: string }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`pms.calculation.${request.runId}`]);
      const existing = await client.query<{
        pool_id: string; business_date: string; rules_version: string;
        status: string; output_checksum_sha256: string | null; maker_id: string | null; run_kind: string;
      }>(
        `SELECT pool_id, business_date::text, rules_version, status, output_checksum_sha256, maker_id, run_kind
         FROM calculation.run WHERE run_id = $1::uuid FOR UPDATE`, [request.runId],
      );
      const run = existing.rows[0];
      if (run) {
        if (run.pool_id !== request.poolId || run.business_date !== request.businessDate ||
          run.rules_version !== request.rulesVersion || run.maker_id !== request.requestedBy ||
          run.run_kind !== (request.runKind ?? 'PARALLEL')) {
          throw new Error('Calculation run identifier conflicts with different inputs');
        }
        if (run.status === 'CALCULATED' && run.output_checksum_sha256) {
          await client.query('COMMIT');
          return { status: 'ALREADY_CALCULATED', outputChecksumSha256: run.output_checksum_sha256 };
        }
        if (run.status !== 'DRAFT') throw new Error(`Calculation run cannot execute from ${run.status}`);
      } else {
        await client.query(
          `INSERT INTO calculation.run
             (run_id, pool_id, business_date, rules_version, engine_version,
              correlation_id, maker_id, status, run_kind)
           VALUES ($1::uuid, $2, $3::date, $4, 'pms-engine/0.1.0', $5::uuid, $6, 'DRAFT', $7)`,
          [request.runId, request.poolId, request.businessDate, request.rulesVersion,
            request.correlationId, request.requestedBy, request.runKind ?? 'PARALLEL'],
        );
      }
      const snapshot = await loadSnapshot(client, request);
      const completed = calculate(snapshot);
      for (const allocation of completed.allocations) {
        await client.query(
          `INSERT INTO calculation.allocation_result
             (run_id, participant_id, amount, currency_code)
           VALUES ($1::uuid, $2::uuid, $3::numeric, $4)`,
          [request.runId, allocation.participantId, allocation.amount, allocation.currency],
        );
      }
      for(const explanation of completed.explanations){await client.query(`INSERT INTO calculation.profit_explanation_output(run_id,account_id,output,output_checksum_sha256)VALUES($1::uuid,$2::uuid,$3::jsonb,$4)`,[request.runId,explanation.accountId,JSON.stringify(explanation),completed.outputChecksumSha256]);}
      const invariant = await client.query<{ balanced: boolean; currency_consistent: boolean }>(
        `SELECT COALESCE(sum(amount), 0) = $2::numeric AS balanced,
                COALESCE(bool_and(currency_code = $3), false) AS currency_consistent
         FROM calculation.allocation_result WHERE run_id = $1::uuid`,
        [request.runId, snapshot.distributableAmount, snapshot.currency],
      );
      if (!invariant.rows[0]?.balanced || !invariant.rows[0]?.currency_consistent) {
        throw new Error('Calculation conservation invariant failed');
      }
      await client.query(
        `UPDATE calculation.run SET status = 'CALCULATED', input_checksum_sha256 = $2,
           output_checksum_sha256 = $3, input_snapshot = $4::jsonb,
           distributable_amount = $5::numeric, currency_code = $6,
           calculated_at = clock_timestamp()
         WHERE run_id = $1::uuid AND status = 'DRAFT'`,
        [request.runId, completed.inputChecksumSha256, completed.outputChecksumSha256,
          JSON.stringify(snapshot), snapshot.distributableAmount, snapshot.currency],
      );
      await client.query('COMMIT');
      return { status: 'CALCULATED', outputChecksumSha256: completed.outputChecksumSha256 };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

async function loadSnapshot(
  client: PoolClient,
  request: CalculationRequest,
): Promise<CalculationSnapshot> {
  const distributable = await client.query<{
    amount: string; currency_code: string; amount_scale: number; source_reference: string;
  }>(
    `SELECT d.amount::text, d.currency_code, p.amount_scale, d.source_reference
     FROM pooling.distributable_result d
     JOIN pooling.pool p ON p.pool_id = d.pool_id AND p.status = 'ACTIVE'
     WHERE d.pool_id = $1 AND d.business_date = $2::date`, [request.poolId, request.businessDate],
  );
  const source = distributable.rows[0];
  if (!source) throw new Error('No active pool distributable result for calculation');
  const participants = await client.query<{ participant_id: string; weight: string;capital_invested:string;valid_from:string;valid_until:string|null;contractual_ratio:string }>(
    `SELECT pv.account_id::text AS participant_id, pv.weight::text,COALESCE(position.balance,0)::text capital_invested,pv.valid_from::text,pv.valid_until::text,COALESCE(subscription.investor_nisba,100)::text contractual_ratio
     FROM pooling.participant_version pv
     JOIN investment.account a ON a.account_id = pv.account_id
       AND a.currency_code = pv.currency_code AND a.status = 'ACTIVE'
     LEFT JOIN investment.subscription_account subscription ON subscription.account_id=pv.account_id
     LEFT JOIN LATERAL(SELECT balance FROM investment.position_snapshot ps WHERE ps.account_id=pv.account_id AND ps.business_date<=$2::date ORDER BY ps.business_date DESC,ps.value_date DESC LIMIT 1)position ON true
     WHERE pv.pool_id = $1 AND pv.currency_code = $3 AND valid_from <= $2::date
       AND (valid_until IS NULL OR valid_until > $2::date)
     ORDER BY pv.account_id`, [request.poolId, request.businessDate, source.currency_code],
  );
  return {
    distributableAmount: source.amount,
    currency: source.currency_code,
    amountScale: source.amount_scale,
    sourceReference: source.source_reference,
    weights: participants.rows.map((row) => ({ participantId: row.participant_id, weight: row.weight })),
    explanationInputs:participants.rows.map(row=>({accountId:row.participant_id,capitalInvested:row.capital_invested,participationBase:row.weight,eligiblePeriodStart:row.valid_from,eligiblePeriodEnd:row.valid_until??request.businessDate,weighting:row.weight,contractualRatio:row.contractual_ratio,reservesUsed:'0',taxAmount:'0'})),
  };
}
