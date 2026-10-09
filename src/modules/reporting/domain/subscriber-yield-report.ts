import { Decimal } from 'decimal.js';
import { classifyMaturityBucket, MATURITY_TENOR_MONTH_BUCKETS, type MaturityTenorMonthBucket } from './maturity-tenor-curve.js';

export interface SubscriberYieldSource {
  accountId: string;
  capitalInvested: string;
  allocatedProfit: string;
  realizedRatePercent: string;
  distributedRatePercent: string;
  maturityDate: string;
}

export interface SubscriberYieldRow {
  accountId: string;
  capitalInvested: string;
  allocatedProfit: string;
  realizedRatePercent: string;
  distributedRatePercent: string;
  maturityDate: string;
  maturityBucket: MaturityTenorMonthBucket;
}

export interface SubscriberYieldBucket {
  bucket: MaturityTenorMonthBucket;
  subscriberCount: number;
  capitalInvested: string;
  allocatedProfit: string;
  averageRatePercent: string;
}

export interface SubscriberYieldReport {
  subscribers: SubscriberYieldRow[];
  byMaturityBucket: SubscriberYieldBucket[];
}

export function buildSubscriberYieldReport(
  businessDate: string,
  sources: readonly SubscriberYieldSource[],
): SubscriberYieldReport {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate) || Number.isNaN(Date.parse(`${businessDate}T00:00:00Z`))) {
    throw new TypeError('Business date must use YYYY-MM-DD');
  }
  const subscribers = sources.map((source) => ({
    accountId: source.accountId,
    capitalInvested: source.capitalInvested,
    allocatedProfit: source.allocatedProfit,
    realizedRatePercent: source.realizedRatePercent,
    distributedRatePercent: source.distributedRatePercent,
    maturityDate: source.maturityDate,
    maturityBucket: classifyMaturityBucket(businessDate, source.maturityDate),
  }));
  const byMaturityBucket = MATURITY_TENOR_MONTH_BUCKETS.map((bucket) => {
    const members = subscribers.filter((row) => row.maturityBucket === bucket);
    const capital = members.reduce((sum, row) => sum.plus(row.capitalInvested), new Decimal(0));
    const profit = members.reduce((sum, row) => sum.plus(row.allocatedProfit), new Decimal(0));
    return {
      bucket,
      subscriberCount: members.length,
      capitalInvested: capital.toFixed(12),
      allocatedProfit: profit.toFixed(12),
      averageRatePercent: capital.isZero() ? '0.000000' : profit.div(capital).mul(100).toFixed(6),
    };
  });
  return { subscribers, byMaturityBucket };
}
