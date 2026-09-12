import { Decimal } from 'decimal.js';
import { isBankLiabilityCause, type LossCause } from './loss-classification.js';

const ExactDecimal = Decimal.clone({ precision: 60, rounding: Decimal.ROUND_HALF_EVEN });

export type MusharakaPassivePartner = 'BANK' | 'PARTNER' | 'NONE';
export type MusharakaLossCause = LossCause;

export interface MusharakaAllocationInput {
  result: string;
  bankCapital: string;
  partnerCapital: string;
  bankProfitRatio: string;
  partnerProfitRatio: string;
  passivePartner: MusharakaPassivePartner;
  lossCause?: MusharakaLossCause;
  currencyScale?: number;
}

export interface MusharakaAllocationResult {
  resultType: 'PROFIT' | 'LOSS' | 'ZERO';
  bankAllocation: string;
  partnerAllocation: string;
  bankCapitalRatio: string;
  partnerCapitalRatio: string;
  appliedRule: 'NEGOTIATED_PROFIT_RATIO' | 'CAPITAL_LOSS_RATIO' | 'CAUSAL_BANK_LIABILITY' | 'NONE';
  conservationDifference: string;
}

export interface MoutanaqissaPurchase {
  period: number;
  bankCapitalPurchased: string;
}

export interface MoutanaqissaScheduleInput {
  bankCapital: string;
  partnerCapital: string;
  purchases: readonly MoutanaqissaPurchase[];
  maturityReached: boolean;
  outputScale?: number;
}

export interface MoutanaqissaPeriod {
  period: number;
  bankCapitalPurchased: string;
  remainingBankCapital: string;
  partnerCapital: string;
  bankOwnershipRatio: string;
  partnerOwnershipRatio: string;
  ratioTotal: string;
}

export interface MoutanaqissaScheduleResult {
  periods: readonly MoutanaqissaPeriod[];
  finalBankCapital: string;
  finalPartnerCapital: string;
  fullyAcquired: boolean;
}

export function allocateMusharakaResult(input: MusharakaAllocationInput): MusharakaAllocationResult {
  const scale = currencyScale(input.currencyScale);
  const resultUnits = decimalToUnits(input.result, scale, 'result', true);
  const bankCapital = positive(input.bankCapital, 'bankCapital');
  const partnerCapital = positive(input.partnerCapital, 'partnerCapital');
  const totalCapital = bankCapital.plus(partnerCapital);
  const bankCapitalRatio = bankCapital.dividedBy(totalCapital);
  const partnerCapitalRatio = partnerCapital.dividedBy(totalCapital);
  const bankProfitRatio = ratio(input.bankProfitRatio, 'bankProfitRatio');
  const partnerProfitRatio = ratio(input.partnerProfitRatio, 'partnerProfitRatio');
  if (!bankProfitRatio.plus(partnerProfitRatio).equals(1)) throw new RangeError('Musharaka profit ratios must total exactly 1');
  if (input.passivePartner === 'BANK' && bankProfitRatio.greaterThan(bankCapitalRatio)) {
    throw new RangeError('Passive bank profit ratio cannot exceed its capital ratio');
  }
  if (input.passivePartner === 'PARTNER' && partnerProfitRatio.greaterThan(partnerCapitalRatio)) {
    throw new RangeError('Passive partner profit ratio cannot exceed its capital ratio');
  }

  if (resultUnits === 0n) return allocationResult(0n, 0n, 0n, scale, bankCapitalRatio, partnerCapitalRatio, 'NONE');
  if (resultUnits > 0n) {
    const [bank, partner] = splitUnits(resultUnits, bankProfitRatio, partnerProfitRatio);
    return allocationResult(resultUnits, bank, partner, scale, bankCapitalRatio, partnerCapitalRatio, 'NEGOTIATED_PROFIT_RATIO');
  }

  const causalBankLiability = input.lossCause !== undefined && isBankLiabilityCause(input.lossCause);
  if (causalBankLiability) {
    return allocationResult(resultUnits, resultUnits, 0n, scale, bankCapitalRatio, partnerCapitalRatio, 'CAUSAL_BANK_LIABILITY');
  }
  const loss = -resultUnits;
  const [bankLoss, partnerLoss] = splitUnits(loss, bankCapitalRatio, partnerCapitalRatio);
  return allocationResult(resultUnits, -bankLoss, -partnerLoss, scale, bankCapitalRatio, partnerCapitalRatio, 'CAPITAL_LOSS_RATIO');
}

export function buildMoutanaqissaSchedule(input: MoutanaqissaScheduleInput): MoutanaqissaScheduleResult {
  const scale = input.outputScale ?? 12;
  if (!Number.isInteger(scale) || scale < 0 || scale > 24) throw new RangeError('outputScale must be an integer between 0 and 24');
  let bankCapital = positive(input.bankCapital, 'bankCapital');
  let partnerCapital = positive(input.partnerCapital, 'partnerCapital');
  const initialTotal = bankCapital.plus(partnerCapital);
  let previousPeriod = 0;
  const periods = input.purchases.map((purchase) => {
    if (!Number.isInteger(purchase.period) || purchase.period <= previousPeriod) {
      throw new RangeError('Purchase periods must be positive and strictly increasing');
    }
    previousPeriod = purchase.period;
    const purchased = positive(purchase.bankCapitalPurchased, `bankCapitalPurchased:${purchase.period}`);
    if (purchased.greaterThan(bankCapital)) throw new RangeError(`Purchase at period ${purchase.period} exceeds remaining bank capital`);
    bankCapital = bankCapital.minus(purchased);
    partnerCapital = partnerCapital.plus(purchased);
    const bankRatio = bankCapital.dividedBy(initialTotal);
    const partnerRatio = partnerCapital.dividedBy(initialTotal);
    const ratioTotal = bankRatio.plus(partnerRatio);
    if (!ratioTotal.equals(1)) throw new Error('Moutanaqissa ownership ratio invariant violated');
    return {
      period: purchase.period,
      bankCapitalPurchased: formatted(purchased, scale),
      remainingBankCapital: formatted(bankCapital, scale),
      partnerCapital: formatted(partnerCapital, scale),
      bankOwnershipRatio: formatted(bankRatio, scale),
      partnerOwnershipRatio: formatted(partnerRatio, scale),
      ratioTotal: formatted(ratioTotal, scale),
    };
  });
  if (input.maturityReached && !bankCapital.isZero()) {
    throw new RangeError('Bank capital must be fully acquired at maturity');
  }
  return {
    periods,
    finalBankCapital: formatted(bankCapital, scale),
    finalPartnerCapital: formatted(partnerCapital, scale),
    fullyAcquired: bankCapital.isZero(),
  };
}

function allocationResult(
  total: bigint,
  bank: bigint,
  partner: bigint,
  scale: number,
  bankCapitalRatio: Decimal,
  partnerCapitalRatio: Decimal,
  appliedRule: MusharakaAllocationResult['appliedRule'],
): MusharakaAllocationResult {
  const difference = total - bank - partner;
  if (difference !== 0n) throw new Error('Musharaka allocation conservation invariant violated');
  return {
    resultType: total > 0n ? 'PROFIT' : total < 0n ? 'LOSS' : 'ZERO',
    bankAllocation: unitsToDecimal(bank, scale),
    partnerAllocation: unitsToDecimal(partner, scale),
    bankCapitalRatio: formatted(bankCapitalRatio, 12),
    partnerCapitalRatio: formatted(partnerCapitalRatio, 12),
    appliedRule,
    conservationDifference: unitsToDecimal(difference, scale),
  };
}

function splitUnits(total: bigint, firstRatio: Decimal, secondRatio: Decimal): [bigint, bigint] {
  const exactFirst = new ExactDecimal(total.toString()).times(firstRatio);
  const exactSecond = new ExactDecimal(total.toString()).times(secondRatio);
  let first = BigInt(exactFirst.floor().toFixed(0));
  let second = BigInt(exactSecond.floor().toFixed(0));
  const residual = total - first - second;
  if (residual > 0n) {
    if (exactFirst.minus(first.toString()).greaterThanOrEqualTo(exactSecond.minus(second.toString()))) first += residual;
    else second += residual;
  }
  return [first, second];
}

function currencyScale(value: number | undefined): number {
  const scale = value ?? 2;
  if (!Number.isInteger(scale) || scale < 0 || scale > 12) throw new RangeError('currencyScale must be an integer between 0 and 12');
  return scale;
}

function ratio(value: string, field: string): Decimal {
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

function decimalToUnits(value: string, scale: number, field: string, signed: boolean): bigint {
  const match = (signed ? /^(-?)(0|[1-9]\d*)(?:\.(\d+))?$/ : /^(0|[1-9]\d*)(?:\.(\d+))?$/).exec(value);
  if (!match) throw new TypeError(`${field} must be a canonical decimal string`);
  const sign = signed ? match[1] : '';
  const integer = signed ? match[2] : match[1];
  const fraction = (signed ? match[3] : match[2]) ?? '';
  if (fraction.length > scale) throw new RangeError(`${field} exceeds currency scale ${scale}`);
  const units = BigInt(`${integer}${fraction.padEnd(scale, '0')}`);
  return sign === '-' ? -units : units;
}

function unitsToDecimal(units: bigint, scale: number): string {
  const negative = units < 0n;
  const digits = (negative ? -units : units).toString().padStart(scale + 1, '0');
  const value = scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return negative ? `-${value}` : value;
}

function formatted(value: Decimal, scale: number): string {
  return value.toDecimalPlaces(scale, Decimal.ROUND_HALF_EVEN).toFixed(scale);
}
