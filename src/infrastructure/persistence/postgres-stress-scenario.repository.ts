import type { Pool } from 'pg';
import type { RunStressScenarioCommand, StressScenarioRepository } from '../../modules/risk-alm/application/run-stress-scenario.js';
import type { StressResult, StressShock } from '../../modules/risk-alm/domain/stress-scenario.js';

export class PostgresStressScenarioRepository implements StressScenarioRepository {
  constructor(private readonly pool: Pick<Pool, 'connect'>) {}
  async runAtomically(
    command: RunStressScenarioCommand,
    execute: (base: string, currency: string, scale: number, shocks: readonly StressShock[]) => StressResult[],
  ) {
    const client = await this.pool.connect();
    let transactionStarted = false;
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
      transactionStarted = true;
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`stress:${command.scenarioCode}:${command.businessDate}:${command.engineVersion}:${command.inputChecksumSha256}`],
      );
      const currency = await client.query<{ amount_scale: number }>(
        `SELECT fraction_digits AS amount_scale FROM reference.currency_version
         WHERE currency_code = $1 AND valid_from <= $2::date
           AND (valid_until IS NULL OR valid_until > $2::date)
         ORDER BY valid_from DESC LIMIT 1`, [command.currency, command.businessDate],
      );
      if (!currency.rows[0]) throw new Error('Stress currency not found');
      const results = execute(command.baseAmount, command.currency, currency.rows[0].amount_scale, command.shocks);
      const parameters = { currency: command.currency, baseAmount: command.baseAmount, shocks: command.shocks };
      const inserted = await client.query<{ stress_scenario_id: string }>(
        `INSERT INTO risk.stress_scenario
          (scenario_code, business_date, status, parameters, results, engine_version,
           input_checksum_sha256, created_by, completed_at)
         VALUES ($1, $2::date, 'COMPLETED', $3::jsonb, $4::jsonb, $5, $6, $7, clock_timestamp())
         ON CONFLICT (scenario_code, business_date, engine_version, input_checksum_sha256) DO NOTHING
         RETURNING stress_scenario_id::text`,
        [command.scenarioCode, command.businessDate, JSON.stringify(parameters), JSON.stringify(results),
          command.engineVersion, command.inputChecksumSha256, command.actorId],
      );
      let stressScenarioId = inserted.rows[0]?.stress_scenario_id;
      let responseResults: readonly StressResult[] = results;
      if (!stressScenarioId) {
        const replay = await client.query<{
          stress_scenario_id: string;
          parameters: { currency?: unknown; baseAmount?: unknown; shocks?: unknown };
          results: unknown;
          created_by: string;
        }>(
          `SELECT stress_scenario_id::text, parameters, results, created_by
           FROM risk.stress_scenario
           WHERE scenario_code = $1 AND business_date = $2::date AND engine_version = $3
             AND input_checksum_sha256 = $4
           FOR SHARE`,
          [command.scenarioCode, command.businessDate, command.engineVersion, command.inputChecksumSha256],
        );
        const snapshot = replay.rows[0];
        if (!snapshot || snapshot.created_by !== command.actorId ||
          !isStressParameterSnapshot(snapshot.parameters, command) ||
          !isStressResultSnapshot(snapshot.results)) {
          throw new Error('Stress scenario replay payload differs');
        }
        stressScenarioId = snapshot.stress_scenario_id;
        responseResults = snapshot.results;
      }
      await client.query('COMMIT');
      transactionStarted = false;
      return { stressScenarioId, state: 'COMPLETED' as const, results: responseResults };
    } catch (error) {
      if (transactionStarted) await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
}

function isStressParameterSnapshot(
  value: { currency?: unknown; baseAmount?: unknown; shocks?: unknown },
  command: RunStressScenarioCommand,
): boolean {
  return value.currency === command.currency && value.baseAmount === command.baseAmount &&
    JSON.stringify(value.shocks) === JSON.stringify(command.shocks);
}

function isStressResultSnapshot(value: unknown): value is StressResult[] {
  return Array.isArray(value) && value.every((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const result = entry as Partial<StressResult>;
    return typeof result.bucket === 'string' && Number.isInteger(result.basisPoints) &&
      typeof result.stressedAmount === 'string' && typeof result.impactAmount === 'string';
  });
}
