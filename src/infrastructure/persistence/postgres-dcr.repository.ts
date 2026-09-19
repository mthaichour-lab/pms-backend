import type { Pool } from 'pg';
import type { CalculateDcrCommand, DcrRepository } from '../../modules/risk-alm/application/calculate-dcr.js';
import type { DcrInput, DcrResult } from '../../modules/risk-alm/domain/dcr.js';

export class PostgresDcrRepository implements DcrRepository {
  constructor(private readonly pool: Pick<Pool, 'connect'>) {}

  async calculateAtomically(command: CalculateDcrCommand, calculate: (input: DcrInput) => DcrResult) {
    const client = await this.pool.connect();
    let transactionStarted = false;
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
      transactionStarted = true;
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`dcr:${command.poolId}:${command.businessDate}:${command.formulaVersion}:${command.inputChecksumSha256}`],
      );
      const reference = await client.query<{ amount_scale: number }>(
        `SELECT c.fraction_digits AS amount_scale FROM reference.currency_version c
         JOIN pooling.pool p ON p.currency_code = c.currency_code
         WHERE p.pool_id = $1 AND c.currency_code = $2
           AND c.valid_from <= $3::date
           AND (c.valid_until IS NULL OR c.valid_until > $3::date)
         ORDER BY c.valid_from DESC LIMIT 1`, [command.poolId, command.currency, command.businessDate],
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
      let response = result;
      if (!dcrCalculationId) {
        const replay = await client.query<{ dcr_calculation_id: string; dcr_value: string; threshold: string; state: DcrResult['state'] }>(
          `SELECT dcr_calculation_id::text, dcr_value::text, threshold::text, state
           FROM risk.dcr_calculation WHERE pool_id = $1 AND business_date = $2::date
             AND formula_version = $3 AND input_checksum_sha256 = $4
             AND capital_duration_amount = $5::numeric AND risk_weighted_duration_amount = $6::numeric
             AND currency_code = $7 AND threshold = $8::numeric AND calculated_by = $9
           FOR SHARE`,
          [command.poolId, command.businessDate, command.formulaVersion, command.inputChecksumSha256,
            command.capitalDurationAmount, command.riskWeightedDurationAmount, command.currency,
            command.threshold, command.actorId],
        );
        if (!replay.rows[0]) throw new Error('DCR replay payload differs');
        const snapshot = replay.rows[0];
        dcrCalculationId = snapshot.dcr_calculation_id;
        response = { value: snapshot.dcr_value, threshold: snapshot.threshold, state: snapshot.state };
      }
      await client.query('COMMIT');
      transactionStarted = false;
      return { ...response, dcrCalculationId };
    } catch (error) {
      if (transactionStarted) await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
}
