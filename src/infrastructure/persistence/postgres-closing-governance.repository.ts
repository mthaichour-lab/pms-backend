import type { Pool } from 'pg';
import type { ClosingGovernanceRepository } from '../../modules/closing-workflow/application/process-closing-governance.js';

export class PostgresClosingGovernanceRepository implements ClosingGovernanceRepository {
  constructor(private readonly pool: Pick<Pool, 'query'>) {}

  async escalateOverdue(now: string): Promise<{ escalated: number }> {
    const result = await this.pool.query<{ escalated_count: number }>(
      'SELECT workflow.escalate_overdue_closing_tasks($1::timestamptz) + accounting.escalate_overdue_discrepancies($1::timestamptz) AS escalated_count',
      [now],
    );
    return { escalated: Number(result.rows[0]?.escalated_count ?? 0) };
  }
}
