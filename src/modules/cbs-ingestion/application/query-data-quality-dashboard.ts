import { cbsBatchStates } from '../domain/batch-state.js';

export interface DataQualityDashboardFilter {
  businessDate?: string;
  state?: string;
  limit?: number;
  offset?: number;
}

export interface DataQualityDashboardRow {
  batchId: string;
  sourceCode: string;
  businessDate: string;
  flowType: string;
  sequenceNumber: number;
  state: string;
  manifestRowCount: number | null;
  manifestBalanceTotal: string | null;
  errorCount: number;
  warningCount: number;
  lastControlAt: string | null;
}

export interface DataQualityDashboardRepository {
  list(filter: Required<Pick<DataQualityDashboardFilter, 'limit' | 'offset'>> & DataQualityDashboardFilter): Promise<DataQualityDashboardRow[]>;
}

export class QueryDataQualityDashboard {
  constructor(private readonly repository: DataQualityDashboardRepository) {}

  execute(filter: DataQualityDashboardFilter): Promise<DataQualityDashboardRow[]> {
    if (filter.businessDate && !isDate(filter.businessDate)) throw new TypeError('Invalid business date');
    if (filter.state !== undefined && !cbsBatchStates.includes(filter.state as typeof cbsBatchStates[number])) throw new TypeError('Invalid CBS batch state');
    const limit = filter.limit ?? 50; const offset = filter.offset ?? 0;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new RangeError('Limit must be between 1 and 200');
    if (!Number.isInteger(offset) || offset < 0) throw new RangeError('Offset must be positive');
    return this.repository.list({ ...filter, limit, offset });
  }
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
