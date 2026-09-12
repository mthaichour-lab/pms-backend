import type {
  CalculationRunQueryRepository,
  CalculationRunView,
} from '../../modules/profit-calculation/application/get-calculation-run.js';
import type { SqlClient } from './postgres-client.js';

type RunStatus = CalculationRunView['status'];

export class PostgresCalculationRunQueryRepository implements CalculationRunQueryRepository {
  constructor(private readonly database: SqlClient) {}

  async findById(runId: string): Promise<CalculationRunView | undefined> {
    const runResult = await this.database.query<{
      run_id: string; pool_id: string; business_date: string; rules_version: string;
      engine_version: string; status: RunStatus; input_checksum_sha256: string | null;
      output_checksum_sha256: string | null; distributable_amount: string | null; currency_code: string | null;
    }>(
      `SELECT run_id::text, pool_id, business_date::text, rules_version, engine_version,
              status, input_checksum_sha256, output_checksum_sha256,
              distributable_amount::text, currency_code
       FROM calculation.run WHERE run_id = $1::uuid`, [runId],
    );
    const run = runResult.rows[0];
    if (!run) return undefined;
    const allocations = await this.database.query<{
      participant_id: string; amount: string; currency_code: string;
    }>(
      `SELECT participant_id::text, amount::text, currency_code
       FROM calculation.allocation_result WHERE run_id = $1::uuid ORDER BY participant_id`, [runId],
    );
    return {
      runId: run.run_id, poolId: run.pool_id, businessDate: run.business_date,
      rulesVersion: run.rules_version, engineVersion: run.engine_version, status: run.status,
      inputChecksumSha256: run.input_checksum_sha256 ?? undefined,
      outputChecksumSha256: run.output_checksum_sha256 ?? undefined,
      distributableAmount: run.distributable_amount ?? undefined,
      currency: run.currency_code ?? undefined,
      allocations: allocations.rows.map((row) => ({
        participantId: row.participant_id, amount: row.amount, currency: row.currency_code,
      })),
    };
  }
}
