import { Decimal } from 'decimal.js';
import { classifyMaturityBucket, MATURITY_TENOR_MONTH_BUCKETS, type MaturityTenorMonthBucket } from './maturity-tenor-curve.js';

export interface RevenueRecord {
  glAccountCode: string;
  amount: string;
  cashStatus: 'ACCRUED' | 'RECEIVED';
  maturityDate?: string;
}

export interface RevenueYieldByGlAccount {
  glAccountCode: string;
  receivedAmount: string;
  accruedAmount: string;
  receivedRatePercent: string;
  recognizedRatePercent: string;
}

export interface RevenueYieldBucket {
  bucket: MaturityTenorMonthBucket;
  receivedAmount: string;
  accruedAmount: string;
  receivedRatePercent: string;
  recognizedRatePercent: string;
}

export interface RevenueYieldReport {
  poolId: string;
  currency: string;
  periodFrom: string;
  periodTo: string;
  capitalBase: string;
  byGlAccount: RevenueYieldByGlAccount[];
  byMaturityBucket: RevenueYieldBucket[];
}

export function buildRevenueYieldReport(
  poolId: string,
  currency: string,
  periodFrom: string,
  periodTo: string,
  capitalBase: string,
  businessDate: string,
  records: readonly RevenueRecord[],
): RevenueYieldReport {
  const base = new Decimal(capitalBase);
  const rate = (received: Decimal, recognized: Decimal) => ({
    receivedRatePercent: base.isZero() ? '0.000000' : received.div(base).mul(100).toFixed(6),
    recognizedRatePercent: base.isZero() ? '0.000000' : recognized.div(base).mul(100).toFixed(6),
  });

  const glCodes = [...new Set(records.map((record) => record.glAccountCode))].sort();
  const byGlAccount = glCodes.map((glAccountCode) => {
    const members = records.filter((record) => record.glAccountCode === glAccountCode);
    const received = members.filter((record) => record.cashStatus === 'RECEIVED').reduce((sum, record) => sum.plus(record.amount), new Decimal(0));
    const accrued = members.filter((record) => record.cashStatus === 'ACCRUED').reduce((sum, record) => sum.plus(record.amount), new Decimal(0));
    return {
      glAccountCode,
      receivedAmount: received.toFixed(12),
      accruedAmount: accrued.toFixed(12),
      ...rate(received, received.plus(accrued)),
    };
  });

  const byMaturityBucket = MATURITY_TENOR_MONTH_BUCKETS.map((bucket) => {
    const members = records.filter((record) => record.maturityDate !== undefined && classifyMaturityBucket(businessDate, record.maturityDate) === bucket);
    const received = members.filter((record) => record.cashStatus === 'RECEIVED').reduce((sum, record) => sum.plus(record.amount), new Decimal(0));
    const accrued = members.filter((record) => record.cashStatus === 'ACCRUED').reduce((sum, record) => sum.plus(record.amount), new Decimal(0));
    return {
      bucket,
      receivedAmount: received.toFixed(12),
      accruedAmount: accrued.toFixed(12),
      ...rate(received, received.plus(accrued)),
    };
  });

  return { poolId, currency, periodFrom, periodTo, capitalBase: base.toFixed(12), byGlAccount, byMaturityBucket };
}
