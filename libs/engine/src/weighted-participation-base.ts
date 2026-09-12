import { Decimal } from 'decimal.js';

const ExactDecimal = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_EVEN });
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_IN_MILLISECONDS = 86_400_000;

export type BalanceConvention =
  | 'DAILY_BALANCE'
  | 'AVERAGE_DAILY_BALANCE'
  | 'MINIMUM_DAILY_BALANCE'
  | 'PARTICIPATION_UNITS';

export type DayCountConvention = 'ACTUAL_365' | 'ACTUAL_360';

export interface ParticipationObservation {
  businessDate: string;
  eligibleBalance: string;
  participationUnits?: string;
  participationUnitValue?: string;
}

export interface WeightedParticipationInput {
  accountId: string;
  periodStart: string;
  periodEnd: string;
  balanceConvention: BalanceConvention;
  dayCountConvention: DayCountConvention;
  categoryWeight: string;
  maturityWeight: string;
  observations: readonly ParticipationObservation[];
  outputScale?: number;
}

export interface DailyParticipationBase {
  businessDate: string;
  eligibleBasis: string;
  weightedBasis: string;
  dayFraction: string;
  weightedAccrual: string;
}

export interface WeightedParticipationResult {
  accountId: string;
  periodStart: string;
  periodEnd: string;
  observationCount: number;
  dayCountConvention: DayCountConvention;
  balanceConvention: BalanceConvention;
  averageEligibleBasis: string;
  minimumEligibleBasis: string;
  weightedAmountDays: string;
  weightedParticipationBase: string;
  daily: readonly DailyParticipationBase[];
}

export function calculateWeightedParticipationBase(
  input: WeightedParticipationInput,
): WeightedParticipationResult {
  if (!input.accountId.trim()) throw new TypeError('accountId is required');
  const start = parseDate(input.periodStart, 'periodStart');
  const end = parseDate(input.periodEnd, 'periodEnd');
  if (end < start) throw new RangeError('periodEnd must be on or after periodStart');

  const expectedDays = Math.floor((end - start) / DAY_IN_MILLISECONDS) + 1;
  if (input.observations.length !== expectedDays) {
    throw new RangeError(`Expected ${expectedDays} daily observations, received ${input.observations.length}`);
  }
  const scale = input.outputScale ?? 12;
  if (!Number.isInteger(scale) || scale < 0 || scale > 24) {
    throw new RangeError('outputScale must be an integer between 0 and 24');
  }

  const categoryWeight = nonNegativeDecimal(input.categoryWeight, 'categoryWeight');
  const maturityWeight = nonNegativeDecimal(input.maturityWeight, 'maturityWeight');
  const weight = categoryWeight.times(maturityWeight);
  const denominator = new ExactDecimal(input.dayCountConvention === 'ACTUAL_365' ? 365 : 360);

  const rawBases = input.observations.map((observation, index) => {
    const date = parseDate(observation.businessDate, `observations[${index}].businessDate`);
    const expectedDate = start + index * DAY_IN_MILLISECONDS;
    if (date !== expectedDate) {
      throw new RangeError(`Observation ${index} must be dated ${formatDate(expectedDate)}`);
    }
    return basisForObservation(observation, input.balanceConvention, index);
  });

  const sum = rawBases.reduce((total, value) => total.plus(value), new ExactDecimal(0));
  const average = sum.dividedBy(expectedDays);
  const minimum = rawBases.reduce((lowest, value) => Decimal.min(lowest, value), rawBases[0]);
  const effectiveBases = input.balanceConvention === 'AVERAGE_DAILY_BALANCE'
    ? rawBases.map(() => average)
    : input.balanceConvention === 'MINIMUM_DAILY_BALANCE'
      ? rawBases.map(() => minimum)
      : rawBases;

  const dayFraction = new ExactDecimal(1).dividedBy(denominator);
  let weightedAmountDays = new ExactDecimal(0);
  let weightedParticipationBase = new ExactDecimal(0);
  const daily = input.observations.map((observation, index) => {
    const eligibleBasis = effectiveBases[index];
    const weightedBasis = eligibleBasis.times(weight);
    const weightedAccrual = weightedBasis.times(dayFraction);
    weightedAmountDays = weightedAmountDays.plus(weightedBasis);
    weightedParticipationBase = weightedParticipationBase.plus(weightedAccrual);
    return {
      businessDate: observation.businessDate,
      eligibleBasis: formatDecimal(eligibleBasis, scale),
      weightedBasis: formatDecimal(weightedBasis, scale),
      dayFraction: formatDecimal(dayFraction, scale),
      weightedAccrual: formatDecimal(weightedAccrual, scale),
    };
  });

  return {
    accountId: input.accountId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    observationCount: expectedDays,
    dayCountConvention: input.dayCountConvention,
    balanceConvention: input.balanceConvention,
    averageEligibleBasis: formatDecimal(average, scale),
    minimumEligibleBasis: formatDecimal(minimum, scale),
    weightedAmountDays: formatDecimal(weightedAmountDays, scale),
    weightedParticipationBase: formatDecimal(weightedParticipationBase, scale),
    daily,
  };
}

function basisForObservation(
  observation: ParticipationObservation,
  convention: BalanceConvention,
  index: number,
): Decimal {
  if (convention !== 'PARTICIPATION_UNITS') {
    return nonNegativeDecimal(observation.eligibleBalance, `observations[${index}].eligibleBalance`);
  }
  if (observation.participationUnits === undefined || observation.participationUnitValue === undefined) {
    throw new TypeError(`Observation ${index} requires participationUnits and participationUnitValue`);
  }
  return nonNegativeDecimal(observation.participationUnits, `observations[${index}].participationUnits`)
    .times(nonNegativeDecimal(observation.participationUnitValue, `observations[${index}].participationUnitValue`));
}

function nonNegativeDecimal(value: string, field: string): Decimal {
  if (!/^(0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    throw new TypeError(`${field} must be a canonical non-negative decimal string`);
  }
  return new ExactDecimal(value);
}

function parseDate(value: string, field: string): number {
  if (!ISO_DATE.test(value)) throw new TypeError(`${field} must use YYYY-MM-DD`);
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed) || formatDate(parsed) !== value) throw new RangeError(`${field} is not a valid date`);
  return parsed;
}

function formatDate(epoch: number): string {
  return new Date(epoch).toISOString().slice(0, 10);
}

function formatDecimal(value: Decimal, scale: number): string {
  return value.toDecimalPlaces(scale, Decimal.ROUND_HALF_EVEN).toFixed(scale);
}
