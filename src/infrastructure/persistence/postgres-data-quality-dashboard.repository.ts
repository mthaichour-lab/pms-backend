import type { DataQualityDashboardFilter, DataQualityDashboardRepository, DataQualityDashboardRow } from '../../modules/cbs-ingestion/application/query-data-quality-dashboard.js';
import type { SqlClient } from './postgres-client.js';

export class PostgresDataQualityDashboardRepository implements DataQualityDashboardRepository {
  constructor(private readonly database: SqlClient) {}

  async list(filter: Required<Pick<DataQualityDashboardFilter, 'limit' | 'offset'>> & DataQualityDashboardFilter): Promise<DataQualityDashboardRow[]> {
    const result = await this.database.query<{
      batch_id: string; source_code: string; business_date: string; flow_type: string;
      sequence_number: number; state: string; manifest_row_count: number | null;
      manifest_balance_total: string | null; error_count: number; warning_count: number; last_control_at: string | null;
    }>(`SELECT batch_id, source_code, business_date::text, flow_type, sequence_number, state,
              manifest_row_count, manifest_balance_total::text, error_count, warning_count, last_control_at::text
       FROM integration.cbs_data_quality_dashboard
       WHERE ($1::date IS NULL OR business_date = $1::date) AND ($2::text IS NULL OR state = $2)
       ORDER BY business_date DESC, sequence_number DESC LIMIT $3 OFFSET $4`,
      [filter.businessDate ?? null, filter.state ?? null, filter.limit, filter.offset]);
    return result.rows.map((row) => ({
      batchId: row.batch_id, sourceCode: row.source_code, businessDate: row.business_date,
      flowType: row.flow_type, sequenceNumber: row.sequence_number, state: row.state,
      manifestRowCount: row.manifest_row_count, manifestBalanceTotal: row.manifest_balance_total,
      errorCount: row.error_count, warningCount: row.warning_count, lastControlAt: row.last_control_at,
    }));
  }
}
