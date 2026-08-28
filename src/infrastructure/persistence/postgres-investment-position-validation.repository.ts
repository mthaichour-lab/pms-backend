import type {
  InvestmentPositionValidationRepository,
  InvestmentPositionValidationResult,
} from '../../modules/cbs-ingestion/application/validate-investment-positions.js';
import type { SqlClient } from './postgres-client.js';

export class PostgresInvestmentPositionValidationRepository implements InvestmentPositionValidationRepository {
  constructor(private readonly database: SqlClient) {}

  async inspect(batchId: string, expectedBusinessDate: string): Promise<InvestmentPositionValidationResult> {
    const result = await this.database.query<{
      row_count: string;
      invalid_business_date_count: string;
    }>(
      `SELECT count(*)::text AS row_count,
              count(*) FILTER (WHERE business_date <> $2::date)::text AS invalid_business_date_count
       FROM integration.cbs_investment_position_staging
       WHERE batch_id = $1::uuid`,
      [batchId, expectedBusinessDate],
    );
    return {
      rowCount: Number(result.rows[0]?.row_count ?? 0),
      invalidBusinessDateCount: Number(result.rows[0]?.invalid_business_date_count ?? 0),
    };
  }

  async recordDecision(
    batchId: string,
    decision: 'VALIDATED' | 'REJECTED',
    reason?: string,
  ): Promise<void> {
    const result = await this.database.query(
      `UPDATE integration.cbs_batch
       SET state = $2, state_reason = $3, updated_at = clock_timestamp()
       WHERE batch_id = $1::uuid AND state IN ('STAGED', $2)`,
      [batchId, decision, reason ?? null],
    );
    if (result.rowCount !== 1) throw new Error(`CBS batch ${batchId} is not staged`);
  }
}
