import { buildSubscriberYieldReport, type SubscriberYieldSource } from '../domain/subscriber-yield-report.js';

export interface SubscriberYieldSourceData {
  runId: string;
  businessDate: string;
  currency: string;
  sources: readonly SubscriberYieldSource[];
}

export interface SubscriberYieldRepository {
  latest(poolId: string): Promise<SubscriberYieldSourceData | undefined>;
}

export class QuerySubscriberYieldReport {
  constructor(private readonly repository: SubscriberYieldRepository) {}

  async execute(poolId: string) {
    if (!/^[A-Za-z0-9._:-]{2,64}$/.test(poolId)) throw new TypeError('Invalid pool identifier');
    const source = await this.repository.latest(poolId);
    if (!source) throw new Error('No posted calculation run found for this pool');
    const report = buildSubscriberYieldReport(source.businessDate, source.sources);
    return { poolId, runId: source.runId, businessDate: source.businessDate, currency: source.currency, ...report };
  }
}
