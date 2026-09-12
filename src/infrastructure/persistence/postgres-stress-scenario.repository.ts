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
    try {
      const currency = await client.query<{ amount_scale: number }>(
        'SELECT amount_scale FROM reference.currency WHERE currency_code = $1', [command.currency],
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
      if (!stressScenarioId) {
        const replay = await client.query<{ stress_scenario_id: string }>(
          `SELECT stress_scenario_id::text FROM risk.stress_scenario
           WHERE scenario_code = $1 AND business_date = $2::date AND engine_version = $3
             AND input_checksum_sha256 = $4 AND parameters = $5::jsonb`,
          [command.scenarioCode, command.businessDate, command.engineVersion,
            command.inputChecksumSha256, JSON.stringify(parameters)],
        );
        if (!replay.rows[0]) throw new Error('Stress scenario replay payload differs');
        stressScenarioId = replay.rows[0].stress_scenario_id;
      }
      return { stressScenarioId, state: 'COMPLETED' as const, results };
    } finally { client.release(); }
  }
}
