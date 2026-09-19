import type { Pool, PoolClient } from 'pg';
import type { RecognizedIncomeRepository } from '../../modules/revenue/application/manage-recognized-income.js';
import type { IncomeAdjustment, RecognizedIncome } from '../../modules/revenue/domain/recognized-income.js';

export class PostgresRecognizedIncomeRepository implements RecognizedIncomeRepository {
  constructor(private readonly pool: Pool) {}

  async importIncome(value: RecognizedIncome): Promise<'CREATED' | 'EXISTING'> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query<{ income_id: string }>(
        `INSERT INTO revenue.recognized_income
          (income_id, source_system, source_reference, asset_id, pool_id, business_date,
           currency_code, amount, cash_status, realization_status, income_type)
         VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6::date, $7, $8::numeric, $9, $10, $11)
         ON CONFLICT (source_system, source_reference, income_type) DO NOTHING
         RETURNING income_id::text`,
        [value.incomeId, value.sourceSystem, value.sourceReference, value.assetId, value.poolId,
          value.businessDate, value.currency, value.amount, value.cashStatus, value.realizationStatus, value.incomeType],
      );
      if (inserted.rowCount === 1) {
        await emit(client, 'RecognizedIncome', value.incomeId, 'RecognizedIncomeImported', {
          sourceSystem: value.sourceSystem, sourceReference: value.sourceReference,
          poolId: value.poolId, businessDate: value.businessDate, amount: value.amount,
          currency: value.currency, incomeType: value.incomeType,
        });
        await client.query('COMMIT');
        return 'CREATED';
      }
      const existing = await client.query<IncomeReplayRow>(
        `SELECT income_id::text, source_system, source_reference, asset_id::text, pool_id,
                business_date::text, currency_code, amount::text, cash_status,
                realization_status, income_type
           FROM revenue.recognized_income
          WHERE source_system = $1 AND source_reference = $2 AND income_type = $3 FOR SHARE`,
        [value.sourceSystem, value.sourceReference, value.incomeType],
      );
      const row = existing.rows[0];
      if (!row || !sameIncome(row, value)) throw new Error('Income source replay conflict');
      await client.query('COMMIT');
      return 'EXISTING';
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async adjust(value: IncomeAdjustment): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query<AdjustmentRow>(
        `SELECT adjustment_id::text, income_id::text, amount::text, reason, approval_id,
                business_date::text, actor_id FROM revenue.income_adjustment
          WHERE adjustment_id = $1::uuid FOR SHARE`, [value.adjustmentId],
      );
      if (existing.rows[0]) {
        if (!sameAdjustment(existing.rows[0], value)) throw new Error('Income adjustment replay conflict');
        await client.query('COMMIT');
        return;
      }
      const approval = await client.query(
        `SELECT 1 FROM workflow.approval_action
          WHERE idempotency_key = $1 AND resource_type = 'RECOGNIZED_INCOME'
            AND resource_id = $2::text AND result_state = 'APPROVED'`,
        [value.approvalId, value.incomeId],
      );
      if (approval.rowCount !== 1) throw new Error('Income adjustment approval is invalid');
      await client.query(
        `INSERT INTO revenue.income_adjustment
          (adjustment_id, income_id, amount, reason, approval_id, business_date, actor_id)
         VALUES ($1::uuid, $2::uuid, $3::numeric, $4, $5, $6::date, $7)`,
        [value.adjustmentId, value.incomeId, value.amount, value.reason.trim(), value.approvalId, value.businessDate, value.actorId.trim()],
      );
      await emit(client, 'RecognizedIncome', value.incomeId, 'RecognizedIncomeAdjusted', {
        adjustmentId: value.adjustmentId, amount: value.amount, approvalId: value.approvalId,
        businessDate: value.businessDate, actorId: value.actorId.trim(),
      });
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async list(poolId: string, businessDate: string): Promise<readonly RecognizedIncome[]> {
    const result = await this.pool.query<IncomeReplayRow>(
      `SELECT income_id::text, source_system, source_reference, asset_id::text, pool_id,
              business_date::text, currency_code, amount::text, cash_status,
              realization_status, income_type FROM revenue.recognized_income
        WHERE pool_id = $1 AND business_date = $2::date ORDER BY source_system, source_reference`, [poolId, businessDate],
    );
    return result.rows.map(row => ({ incomeId: row.income_id, sourceSystem: row.source_system,
      sourceReference: row.source_reference, assetId: row.asset_id, poolId: row.pool_id,
      businessDate: row.business_date, currency: row.currency_code, amount: row.amount,
      cashStatus: row.cash_status, realizationStatus: row.realization_status, incomeType: row.income_type }));
  }
}

interface IncomeReplayRow { income_id: string; source_system: string; source_reference: string; asset_id: string; pool_id: string; business_date: string; currency_code: string; amount: string; cash_status: RecognizedIncome['cashStatus']; realization_status: RecognizedIncome['realizationStatus']; income_type: string; }
interface AdjustmentRow { adjustment_id: string; income_id: string; amount: string; reason: string; approval_id: string; business_date: string; actor_id: string; }
function sameIncome(row: IncomeReplayRow, value: RecognizedIncome): boolean { return row.income_id === value.incomeId && row.source_system === value.sourceSystem && row.source_reference === value.sourceReference && row.asset_id === value.assetId && row.pool_id === value.poolId && row.business_date === value.businessDate && row.currency_code === value.currency && decimalEqual(row.amount, value.amount) && row.cash_status === value.cashStatus && row.realization_status === value.realizationStatus && row.income_type === value.incomeType; }
function sameAdjustment(row: AdjustmentRow, value: IncomeAdjustment): boolean { return row.income_id === value.incomeId && decimalEqual(row.amount, value.amount) && row.reason === value.reason.trim() && row.approval_id === value.approvalId && row.business_date === value.businessDate && row.actor_id === value.actorId.trim(); }
function decimalEqual(left: string, right: string): boolean { const normalize = (value: string) => { const [whole, fraction = ''] = value.split('.'); return `${whole}.${fraction.padEnd(12, '0')}`; }; return normalize(left) === normalize(right); }
async function emit(client: PoolClient, aggregateType: string, aggregateId: string, eventType: string, payload: Record<string, unknown>): Promise<void> { await client.query(`INSERT INTO integration.outbox_event (event_id, aggregate_type, aggregate_id, event_type, schema_version, correlation_id, payload, occurred_at) VALUES (gen_random_uuid(), $1, $2, $3, 1, gen_random_uuid(), $4::jsonb, clock_timestamp())`, [aggregateType, aggregateId, eventType, JSON.stringify(payload)]); }
