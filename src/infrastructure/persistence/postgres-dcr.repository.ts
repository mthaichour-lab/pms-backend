import type { Pool } from 'pg';
import type { CalculateDcrCommand, DcrRepository } from '../../modules/risk-alm/application/calculate-dcr.js';
import type { DcrInput, DcrResult } from '../../modules/risk-alm/domain/dcr.js';

export class PostgresDcrRepository implements DcrRepository {
  constructor(private readonly pool: Pick<Pool, 'connect'>) {}

  async calculateAtomically(command: CalculateDcrCommand, calculate: (input: DcrInput) => DcrResult) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
      const reference = await client.query<{ amount_scale: number }>(
        `SELECT c.amount_scale FROM reference.currency c
         JOIN pooling.pool p ON p.currency_code = c.currency_code
         WHERE p.pool_id = $1 AND c.currency_code = $2`, [command.poolId, command.currency],
      );
      if (!reference.rows[0]) throw new Error('Pool or matching currency not found');
      const result = calculate({
        capitalDurationAmount: command.capitalDurationAmount,
        riskWeightedDurationAmount: command.riskWeightedDurationAmount,
        currency: command.currency, amountScale: reference.rows[0].amount_scale,
        threshold: command.threshold,
      });
      const inserted = await client.query<{ dcr_calculation_id: string }>(
        `INSERT INTO risk.dcr_calculation
          (pool_id, business_date, currency_code, capital_duration_amount,
           risk_weighted_duration_amount, dcr_value, threshold, state,
           formula_version, input_checksum_sha256, calculated_by)
         VALUES ($1, $2::date, $3, $4::numeric, $5::numeric, $6::numeric,
           $7::numeric, $8, $9, $10, $11)
         ON CONFLICT (pool_id, business_date, formula_version, input_checksum_sha256) DO NOTHING
         RETURNING dcr_calculation_id::text`,
        [command.poolId, command.businessDate, command.currency, command.capitalDurationAmount,
          command.riskWeightedDurationAmount, result.value, result.threshold, result.state,
          command.formulaVersion, command.inputChecksumSha256, command.actorId],
      );
      let dcrCalculationId = inserted.rows[0]?.dcr_calculation_id;
      if (!dcrCalculationId) {
        const replay = await client.query<{ dcr_calculation_id: string; dcr_value: string; threshold: string; state: DcrResult['state'] }>(
          `SELECT dcr_calculation_id::text, dcr_value::text, threshold::text, state
           FROM risk.dcr_calculation WHERE pool_id = $1 AND business_date = $2::date
             AND formula_version = $3 AND input_checksum_sha256 = $4
             AND capital_duration_amount = $5::numeric AND risk_weighted_duration_amount = $6::numeric`,
          [command.poolId, command.businessDate, command.formulaVersion, command.inputChecksumSha256,
            command.capitalDurationAmount, command.riskWeightedDurationAmount],
        );
        if (!replay.rows[0]) throw new Error('DCR replay payload differs');
        dcrCalculationId = replay.rows[0].dcr_calculation_id;
      }
      await client.query('COMMIT');
      return { ...result, dcrCalculationId };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
}
