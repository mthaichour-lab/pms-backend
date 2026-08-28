import type {
  CbsBatchDescriptor,
  CbsBatchRepository,
} from '../../modules/cbs-ingestion/application/register-cbs-batch.js';
import type { SqlClient } from './postgres-client.js';
import type { CbsBatchState } from '../../modules/cbs-ingestion/domain/batch-state.js';

export class PostgresCbsBatchRepository implements CbsBatchRepository {
  constructor(private readonly database: SqlClient) {}

  async registerReceived(batch: CbsBatchDescriptor): Promise<{
    status: 'CREATED' | 'EXISTING'; batchId: string; state: CbsBatchState;
  }> {
    const result = await this.database.query<{
      batch_id: string; checksum_sha256: string; object_key: string; inserted: boolean; state: CbsBatchState;
    }>(
      `INSERT INTO integration.cbs_batch
         (batch_id, source_code, business_date, flow_type, sequence_number,
          schema_version, checksum_sha256, object_key, state)
       VALUES ($1::uuid, $2, $3::date, $4, $5, $6, $7, $8, 'RECEIVED')
       ON CONFLICT (source_code, business_date, flow_type, sequence_number)
       DO UPDATE SET source_code = EXCLUDED.source_code
       RETURNING batch_id::text, checksum_sha256, object_key, state, (xmax = 0) AS inserted`,
      [batch.batchId, batch.source, batch.businessDate, batch.flowType, batch.sequence,
        batch.schemaVersion, batch.checksumSha256, batch.objectKey],
    );
    const stored = result.rows[0];
    if (!stored) throw new Error('CBS batch registration returned no row');
    if (stored.checksum_sha256 !== batch.checksumSha256 || stored.object_key !== batch.objectKey) {
      throw new Error('CBS replay key conflicts with a different payload');
    }
    return {
      status: stored.inserted ? 'CREATED' : 'EXISTING',
      batchId: stored.batch_id,
      state: stored.state,
    };
  }

  async transition(
    batchId: string,
    expectedState: 'RECEIVED',
    nextState: 'SCANNED' | 'QUARANTINED',
    reason?: string,
  ): Promise<void> {
    const result = await this.database.query(
      `UPDATE integration.cbs_batch
       SET state = $3, state_reason = $4, updated_at = clock_timestamp()
       WHERE batch_id = $1::uuid AND state IN ($2, $3)`,
      [batchId, expectedState, nextState, reason ?? null],
    );
    if (result.rowCount !== 1) {
      throw new Error(`CBS batch ${batchId} is no longer in ${expectedState}`);
    }
  }
}
