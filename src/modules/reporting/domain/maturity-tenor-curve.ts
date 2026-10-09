import { buildBucketedYield, type TenorCurvePoint, type TenorGap, type TenorObservation } from './tenor-yield-curve.js';

/**
 * Specific-month maturity buckets, as requested for yield/profit reporting on
 * allocations/remuneration and on revenue by pool and by GL account. An
 * overflow bucket ("60M+") is kept so amounts maturing beyond 60 months are
 * never silently dropped from the aggregated totals.
 */
export const MATURITY_TENOR_MONTH_BUCKETS = ['1M', '3M', '6M', '9M', '12M', '18M', '24M', '36M', '48M', '60M', '60M+'] as const;
export type MaturityTenorMonthBucket = typeof MATURITY_TENOR_MONTH_BUCKETS[number];

const buckets = [
  { name: '1M', max: 30 }, { name: '3M', max: 90 }, { name: '6M', max: 180 }, { name: '9M', max: 270 },
  { name: '12M', max: 365 }, { name: '18M', max: 548 }, { name: '24M', max: 730 }, { name: '36M', max: 1095 },
  { name: '48M', max: 1460 }, { name: '60M', max: 1825 }, { name: '60M+', max: Infinity },
] as const;

export function buildMaturityTenorCurve(
  businessDate: string,
  observations: readonly TenorObservation[],
  gaps: readonly TenorGap[],
): TenorCurvePoint[] {
  return buildBucketedYield(businessDate, observations, gaps, buckets);
}

export function classifyMaturityBucket(businessDate: string, maturityDate: string): MaturityTenorMonthBucket {
  const origin = Date.parse(`${businessDate}T00:00:00Z`);
  if (!Number.isFinite(origin)) throw new TypeError('Business date must use YYYY-MM-DD');
  const days = Math.ceil((Date.parse(`${maturityDate}T00:00:00Z`) - origin) / 86_400_000);
  const bucket = buckets.find((entry) => days <= entry.max) ?? buckets[buckets.length - 1]!;
  return bucket.name;
}
