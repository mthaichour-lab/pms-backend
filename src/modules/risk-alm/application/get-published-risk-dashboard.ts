export interface PublishedRiskDashboard {
  runId: string;
  poolId: string;
  businessDate: string;
  currency: string;
  poolProfitRate: string;
  distributedProfitRate: string;
  yieldGap: string;
  bankMargin: string;
  totalResources: string;
  investedAmount: string;
  averageDurationDays: string | null;
  assetConcentrationRate: string;
  maturityGaps: unknown;
  currencyGaps: unknown;
  perCoverageRate: string;
  irrCoverageRate: string;
  dcrValue: string | null;
  dcrState: 'WITHIN_LIMIT' | 'BREACH' | null;
  source: 'LATEST_PUBLISHED_RUN';
  dataQualityWarnings: readonly string[];
}

export interface PublishedRiskDashboardRepository {
  findLatestPublished(poolId: string): Promise<PublishedRiskDashboard | undefined>;
}

export class GetPublishedRiskDashboard {
  constructor(private readonly repository: PublishedRiskDashboardRepository) {}

  async execute(poolId: string): Promise<PublishedRiskDashboard> {
    const normalized = poolId.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/.test(normalized)) throw new TypeError('Invalid risk dashboard pool identifier');
    const dashboard = await this.repository.findLatestPublished(normalized);
    if (!dashboard) throw new Error('No published calculation run is available for this pool');
    if (dashboard.source !== 'LATEST_PUBLISHED_RUN') throw new Error('Risk dashboard source invariant violated');
    return dashboard;
  }
}
