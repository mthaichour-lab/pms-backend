import { Decimal } from 'decimal.js';

const ExactDecimal = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_EVEN });

export interface DistributablePoolProfitInput {
  poolId: string;
  revenue: string;
  approvedCharges: string;
  losses: string;
  nonCompliantIncome: string;
  adjustments: string;
  bankEconomicShare: string;
  moudaribRemuneration: string;
  perAllocation: string;
  irrAllocation: string;
  poolParticipationBase: string;
  partialBackingBase?: string;
  outputScale?: number;
}

export interface DistributablePoolProfitResult {
  poolId: string;
  grossResult: string;
  purifiedAmount: string;
  netDistributableProfit: string;
  bankEconomicShare: string;
  moudaribRemuneration: string;
  bankTotalShare: string;
  investorShare: string;
  perAllocation: string;
  irrAllocation: string;
  poolReturnRate: string;
  partialBackingReturnRate?: string;
  conservationDifference: string;
}

export function calculateDistributablePoolProfit(
  input: DistributablePoolProfitInput,
): DistributablePoolProfitResult {
  if (!input.poolId.trim()) throw new TypeError('poolId is required');
  const scale = input.outputScale ?? 12;
  if (!Number.isInteger(scale) || scale < 0 || scale > 24) {
    throw new RangeError('outputScale must be an integer between 0 and 24');
  }

  const revenue = amount(input.revenue, 'revenue');
  const charges = nonNegativeAmount(input.approvedCharges, 'approvedCharges');
  const losses = nonNegativeAmount(input.losses, 'losses');
  const purification = nonNegativeAmount(input.nonCompliantIncome, 'nonCompliantIncome');
  const adjustments = amount(input.adjustments, 'adjustments');
  const bankEconomic = nonNegativeAmount(input.bankEconomicShare, 'bankEconomicShare');
  const moudarib = nonNegativeAmount(input.moudaribRemuneration, 'moudaribRemuneration');
  const per = nonNegativeAmount(input.perAllocation, 'perAllocation');
  const irr = nonNegativeAmount(input.irrAllocation, 'irrAllocation');
  const participationBase = positiveAmount(input.poolParticipationBase, 'poolParticipationBase');

  const grossResult = revenue.plus(adjustments).minus(charges).minus(losses);
  if (grossResult.isNegative()) throw new RangeError('grossResult cannot be negative in the profit waterfall');
  const netDistributable = grossResult.minus(purification);
  if (netDistributable.isNegative()) throw new RangeError('nonCompliantIncome cannot exceed grossResult');

  const fixedAllocations = bankEconomic.plus(moudarib).plus(per).plus(irr);
  const investor = netDistributable.minus(fixedAllocations);
  if (investor.isNegative()) throw new RangeError('Bank and reserve allocations exceed net distributable profit');
  const bankTotal = bankEconomic.plus(moudarib);
  const conserved = bankTotal.plus(investor).plus(per).plus(irr).plus(purification);
  const difference = grossResult.minus(conserved);
  if (!difference.isZero()) throw new Error('Profit conservation invariant violated');

  const partialBackingRate = input.partialBackingBase === undefined
    ? undefined
    : grossResult.dividedBy(positiveAmount(input.partialBackingBase, 'partialBackingBase'));

  return {
    poolId: input.poolId,
    grossResult: formatted(grossResult, scale),
    purifiedAmount: formatted(purification, scale),
    netDistributableProfit: formatted(netDistributable, scale),
    bankEconomicShare: formatted(bankEconomic, scale),
    moudaribRemuneration: formatted(moudarib, scale),
    bankTotalShare: formatted(bankTotal, scale),
    investorShare: formatted(investor, scale),
    perAllocation: formatted(per, scale),
    irrAllocation: formatted(irr, scale),
    poolReturnRate: formatted(grossResult.dividedBy(participationBase), scale),
    ...(partialBackingRate === undefined ? {} : { partialBackingReturnRate: formatted(partialBackingRate, scale) }),
    conservationDifference: formatted(difference, scale),
  };
}

function amount(value: string, field: string): Decimal {
  if (!/^-?(0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    throw new TypeError(`${field} must be a canonical decimal string`);
  }
  return new ExactDecimal(value);
}

function nonNegativeAmount(value: string, field: string): Decimal {
  const parsed = amount(value, field);
  if (parsed.isNegative()) throw new RangeError(`${field} cannot be negative`);
  return parsed;
}

function positiveAmount(value: string, field: string): Decimal {
  const parsed = nonNegativeAmount(value, field);
  if (parsed.isZero()) throw new RangeError(`${field} must be positive`);
  return parsed;
}

function formatted(value: Decimal, scale: number): string {
  return value.toDecimalPlaces(scale, Decimal.ROUND_HALF_EVEN).toFixed(scale);
}
