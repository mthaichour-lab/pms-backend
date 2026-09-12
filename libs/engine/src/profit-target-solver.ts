import { Decimal } from 'decimal.js';

const ExactDecimal = Decimal.clone({ precision: 60, rounding: Decimal.ROUND_HALF_EVEN });

export type ProfitTargetLever = 'DISTRIBUTION_KEY' | 'TANAZUL' | 'PER' | 'IRR';
export type SolverStatus = 'APPLICABLE' | 'NEXT_PERIOD_OR_TANAZUL' | 'GOVERNANCE_REQUIRED' | 'OUT_OF_RANGE';

export interface ProfitTargetSolverInput {
  backingBase: string;
  targetNetRate: string;
  currentInvestorProfit: string;
  distributableProfitBeforeShare: string;
  currentInvestorKey: string;
  availableBankShareForTanazul: string;
  perMinimumAdjustment: string;
  perMaximumAdjustment: string;
  irrMinimumAdjustment: string;
  irrMaximumAdjustment: string;
  lever: ProfitTargetLever;
  outputScale?: number;
}

export interface ProfitTargetSolverResult {
  lever: ProfitTargetLever;
  status: SolverStatus;
  requiredValue?: string;
  requiredProfitAdjustment: string;
  targetInvestorProfit: string;
  achievableNetRateMinimum: string;
  achievableNetRateMaximum: string;
  governance: readonly string[];
  alternatives: readonly string[];
}

export function solveProfitTarget(input: ProfitTargetSolverInput): ProfitTargetSolverResult {
  const scale = input.outputScale ?? 12;
  if (!Number.isInteger(scale) || scale < 0 || scale > 24) throw new RangeError('outputScale must be an integer between 0 and 24');
  const base = positive(input.backingBase, 'backingBase');
  const targetRate = nonNegative(input.targetNetRate, 'targetNetRate');
  const currentProfit = nonNegative(input.currentInvestorProfit, 'currentInvestorProfit');
  const distributable = positive(input.distributableProfitBeforeShare, 'distributableProfitBeforeShare');
  const currentKey = boundedRate(input.currentInvestorKey, 'currentInvestorKey');
  const bankShare = nonNegative(input.availableBankShareForTanazul, 'availableBankShareForTanazul');
  const targetProfit = base.times(targetRate);
  const adjustment = targetProfit.minus(currentProfit);

  if (input.lever === 'DISTRIBUTION_KEY') {
    const requiredKey = targetProfit.dividedBy(distributable);
    const minProfit = new ExactDecimal(0);
    const maxProfit = distributable;
    if (requiredKey.isNegative() || requiredKey.greaterThan(1)) {
      return response(input.lever, 'OUT_OF_RANGE', undefined, adjustment, targetProfit, minProfit, maxProfit, base, scale, [], []);
    }
    if (requiredKey.greaterThan(currentKey)) {
      return response(input.lever, 'NEXT_PERIOD_OR_TANAZUL', requiredKey, adjustment, targetProfit, minProfit, maxProfit, base, scale,
        ['CONTRACTUAL_KEY_CANNOT_INCREASE_DURING_CURRENT_PERIOD'], ['PUBLISH_KEY_FOR_NEXT_PERIOD', 'USE_DOCUMENTED_TANAZUL']);
    }
    return response(input.lever, 'APPLICABLE', requiredKey, adjustment, targetProfit, minProfit, maxProfit, base, scale, [], []);
  }

  if (input.lever === 'TANAZUL') {
    const minAdjustment = new ExactDecimal(0);
    const maxAdjustment = bankShare;
    const reachable = adjustment.greaterThanOrEqualTo(minAdjustment) && adjustment.lessThanOrEqualTo(maxAdjustment);
    return response(input.lever, reachable ? 'APPLICABLE' : 'OUT_OF_RANGE', reachable ? adjustment : undefined,
      adjustment, targetProfit, currentProfit.plus(minAdjustment), currentProfit.plus(maxAdjustment), base, scale,
      ['DOCUMENT_TANAZUL', 'REPORT_TO_SHARIA_COMMITTEE'], []);
  }

  const minimum = signed(input.lever === 'PER' ? input.perMinimumAdjustment : input.irrMinimumAdjustment,
    input.lever === 'PER' ? 'perMinimumAdjustment' : 'irrMinimumAdjustment');
  const maximum = signed(input.lever === 'PER' ? input.perMaximumAdjustment : input.irrMaximumAdjustment,
    input.lever === 'PER' ? 'perMaximumAdjustment' : 'irrMaximumAdjustment');
  if (minimum.greaterThan(maximum)) throw new RangeError(`${input.lever} minimum adjustment cannot exceed maximum adjustment`);
  const reachable = adjustment.greaterThanOrEqualTo(minimum) && adjustment.lessThanOrEqualTo(maximum);
  return response(input.lever, reachable ? 'GOVERNANCE_REQUIRED' : 'OUT_OF_RANGE', reachable ? adjustment : undefined,
    adjustment, targetProfit, currentProfit.plus(minimum), currentProfit.plus(maximum), base, scale,
    ['ALCO_APPROVAL_REQUIRED', 'SHARIA_COMMITTEE_APPROVAL_REQUIRED'], []);
}

function response(
  lever: ProfitTargetLever,
  status: SolverStatus,
  requiredValue: Decimal | undefined,
  adjustment: Decimal,
  targetProfit: Decimal,
  minimumProfit: Decimal,
  maximumProfit: Decimal,
  base: Decimal,
  scale: number,
  governance: readonly string[],
  alternatives: readonly string[],
): ProfitTargetSolverResult {
  return {
    lever,
    status,
    ...(requiredValue === undefined ? {} : { requiredValue: formatted(requiredValue, scale) }),
    requiredProfitAdjustment: formatted(adjustment, scale),
    targetInvestorProfit: formatted(targetProfit, scale),
    achievableNetRateMinimum: formatted(Decimal.max(minimumProfit, 0).dividedBy(base), scale),
    achievableNetRateMaximum: formatted(Decimal.max(maximumProfit, 0).dividedBy(base), scale),
    governance,
    alternatives,
  };
}

function boundedRate(value: string, field: string): Decimal {
  const parsed = nonNegative(value, field);
  if (parsed.greaterThan(1)) throw new RangeError(`${field} cannot exceed 1`);
  return parsed;
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

function signed(value: string, field: string): Decimal {
  if (!/^-?(0|[1-9]\d*)(?:\.\d+)?$/.test(value)) throw new TypeError(`${field} must be a canonical decimal string`);
  return new ExactDecimal(value);
}

function formatted(value: Decimal, scale: number): string {
  return value.toDecimalPlaces(scale, Decimal.ROUND_HALF_EVEN).toFixed(scale);
}
