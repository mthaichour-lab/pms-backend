import { buildRevenueYieldReport, type RevenueRecord } from '../domain/revenue-yield-report.js';

export interface RevenueYieldSourceData {
  businessDate: string;
  currency: string;
  capitalBase: string;
  records: readonly RevenueRecord[];
}

export interface RevenueYieldRepository {
  forPeriod(poolId: string, periodFrom: string, periodTo: string): Promise<RevenueYieldSourceData | undefined>;
}

export class QueryRevenueYieldReport {
  constructor(private readonly repository: RevenueYieldRepository) {}

  async execute(poolId: string, periodFrom: string, periodTo: string) {
    if (!/^[A-Za-z0-9._:-]{2,64}$/.test(poolId)) throw new TypeError('Invalid pool identifier');
    const isoDate = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoDate.test(periodFrom) || !isoDate.test(periodTo)) throw new TypeError('Invalid reporting period bounds');
    if (periodFrom > periodTo) throw new TypeError('Reporting period start must not be after its end');
    const source = await this.repository.forPeriod(poolId, periodFrom, periodTo);
    if (!source) throw new Error('No certified pool composition found for this period');
    return buildRevenueYieldReport(poolId, source.currency, periodFrom, periodTo, source.capitalBase, source.businessDate, source.records);
  }
}
