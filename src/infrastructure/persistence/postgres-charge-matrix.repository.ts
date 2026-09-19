import type { Pool, PoolClient } from 'pg';
import type { ChargeMatrixRepository } from '../../modules/revenue/application/manage-charge-matrix.js';
import type { ChargePolicy, PoolCharge } from '../../modules/revenue/domain/charge-policy.js';

export class PostgresChargeMatrixRepository implements ChargeMatrixRepository {
  constructor(private readonly pool: Pool) {}

  async savePolicy(value: ChargePolicy, actorId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`charge-policy:${value.categoryCode}`]);
      if (value.shariaApprovalId) {
        const approval = await client.query(
          `SELECT 1 FROM workflow.approval_action WHERE idempotency_key = $1
             AND resource_type = 'CHARGE_POLICY' AND resource_id = $2
             AND result_state = 'APPROVED'`, [value.shariaApprovalId, value.categoryCode],
        );
        if (approval.rowCount !== 1) throw new Error('Charge policy Sharia approval is invalid');
      }
      await client.query(
        `INSERT INTO revenue.charge_policy
          (policy_id, category_code, responsibility, effective_from, effective_to,
           sharia_approval_id, version, created_by)
         VALUES ($1::uuid, $2, $3, $4::date, $5::date, $6, $7, $8)`,
        [value.policyId, value.categoryCode, value.responsibility, value.effectiveFrom,
          value.effectiveTo ?? null, value.shariaApprovalId ?? null, value.version, actorId.trim()],
      );
      await emit(client, 'ChargePolicy', value.policyId, 'ChargePolicyConfigured', { ...value, actorId: actorId.trim() });
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async importCharge(value: PoolCharge): Promise<'CREATED' | 'EXISTING'> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query<{ charge_id: string }>(
        `INSERT INTO revenue.pool_charge
          (charge_id, pool_id, category_code, business_date, currency_code, amount, source_reference)
         VALUES ($1::uuid, $2, $3, $4::date, $5, $6::numeric, $7)
         ON CONFLICT (source_reference) DO NOTHING RETURNING charge_id::text`,
        [value.chargeId, value.poolId, value.categoryCode, value.businessDate, value.currency, value.amount, value.sourceReference],
      );
      if (inserted.rowCount === 1) {
        await emit(client, 'PoolCharge', value.chargeId, 'PoolChargeImported', { ...value });
        await client.query('COMMIT');
        return 'CREATED';
      }
      const existing = await client.query<ChargeReplayRow>(
        `SELECT charge_id::text, pool_id, category_code, business_date::text,
                currency_code, amount::text, source_reference
           FROM revenue.pool_charge WHERE source_reference = $1 FOR SHARE`, [value.sourceReference],
      );
      const row = existing.rows[0];
      if (!row || !sameCharge(row, value)) throw new Error('Charge source replay conflict');
      await client.query('COMMIT');
      return 'EXISTING';
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async findCharges(poolId: string, date: string): Promise<readonly PoolCharge[]> {
    const result = await this.pool.query<ChargeReplayRow>(
      `SELECT charge_id::text, pool_id, category_code, business_date::text,
              currency_code, amount::text, source_reference
         FROM revenue.pool_charge WHERE pool_id = $1 AND business_date = $2::date
        ORDER BY source_reference`, [poolId, date],
    );
    return result.rows.map(row => ({ chargeId: row.charge_id, poolId: row.pool_id,
      categoryCode: row.category_code, businessDate: row.business_date,
      currency: row.currency_code, amount: row.amount, sourceReference: row.source_reference }));
  }

  async effectivePolicies(date: string): Promise<readonly ChargePolicy[]> {
    const result = await this.pool.query<PolicyRow>(
      `SELECT DISTINCT ON (category_code) policy_id::text, category_code, responsibility,
              effective_from::text, effective_to::text, sharia_approval_id, version
         FROM revenue.charge_policy
        WHERE effective_from <= $1::date AND (effective_to IS NULL OR effective_to >= $1::date)
        ORDER BY category_code, version DESC`, [date],
    );
    return result.rows.map(row => ({ policyId: row.policy_id, categoryCode: row.category_code,
      responsibility: row.responsibility, effectiveFrom: row.effective_from,
      ...(row.effective_to ? { effectiveTo: row.effective_to } : {}),
      ...(row.sharia_approval_id ? { shariaApprovalId: row.sharia_approval_id } : {}), version: row.version }));
  }
}

interface ChargeReplayRow { charge_id: string; pool_id: string; category_code: string; business_date: string; currency_code: string; amount: string; source_reference: string; }
interface PolicyRow { policy_id: string; category_code: string; responsibility: ChargePolicy['responsibility']; effective_from: string; effective_to: string | null; sharia_approval_id: string | null; version: number; }
function sameCharge(row: ChargeReplayRow, value: PoolCharge): boolean { return row.charge_id === value.chargeId && row.pool_id === value.poolId && row.category_code === value.categoryCode && row.business_date === value.businessDate && row.currency_code === value.currency && decimalEqual(row.amount, value.amount) && row.source_reference === value.sourceReference; }
function decimalEqual(left: string, right: string): boolean { const normalize = (v: string) => { const [whole, fraction = ''] = v.split('.'); return `${whole}.${fraction.padEnd(12, '0')}`; }; return normalize(left) === normalize(right); }
async function emit(client: PoolClient, aggregateType: string, aggregateId: string, eventType: string, payload: Record<string, unknown>): Promise<void> { await client.query(`INSERT INTO integration.outbox_event (event_id, aggregate_type, aggregate_id, event_type, schema_version, correlation_id, payload, occurred_at) VALUES (gen_random_uuid(), $1, $2, $3, 1, gen_random_uuid(), $4::jsonb, clock_timestamp())`, [aggregateType, aggregateId, eventType, JSON.stringify(payload)]); }
