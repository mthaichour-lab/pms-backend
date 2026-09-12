import { Decimal } from 'decimal.js';

const ExactDecimal = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_EVEN });

export interface ConsolidatedDcrInput {
  theoreticalShareholderProfit: string;
  reserveReleases: readonly string[];
  tanazulAmounts: readonly string[];
  outputScale?: number;
}

export interface ConsolidatedDcrResult {
  theoreticalShareholderProfit: string;
  reserveSupport: string;
  tanazulSupport: string;
  totalVoluntarySupport: string;
  consolidatedDcr: string;
}

export function calculateConsolidatedDcr(input: ConsolidatedDcrInput): ConsolidatedDcrResult {
  const scale = input.outputScale ?? 12;
  if (!Number.isInteger(scale) || scale < 0 || scale > 24) throw new RangeError('outputScale must be an integer between 0 and 24');
  const theoretical = positive(input.theoreticalShareholderProfit, 'theoreticalShareholderProfit');
  const reserves = sum(input.reserveReleases, 'reserveReleases');
  const tanazul = sum(input.tanazulAmounts, 'tanazulAmounts');
  const support = reserves.plus(tanazul);
  return {
    theoreticalShareholderProfit: formatted(theoretical, scale),
    reserveSupport: formatted(reserves, scale),
    tanazulSupport: formatted(tanazul, scale),
    totalVoluntarySupport: formatted(support, scale),
    consolidatedDcr: formatted(support.dividedBy(theoretical), scale),
  };
}

function sum(values: readonly string[], field: string): Decimal {
  return values.reduce((total, value, index) => total.plus(nonNegative(value, `${field}[${index}]`)), new ExactDecimal(0));
}
function positive(value: string, field: string): Decimal {
  const parsed = nonNegative(value, field);
  if (!parsed.isPositive()) throw new RangeError(`${field} must be positive`);
  return parsed;
}
function nonNegative(value: string, field: string): Decimal {
  if (!/^(0|[1-9]\d*)(?:\.\d+)?$/.test(value)) throw new TypeError(`${field} must be a canonical non-negative decimal string`);
  return new ExactDecimal(value);
}
function formatted(value: Decimal, scale: number): string {
  return value.toDecimalPlaces(scale, Decimal.ROUND_HALF_EVEN).toFixed(scale);
}
