import { Decimal } from 'decimal.js';
import { isBankLiabilityCause, type LossCause } from './loss-classification.js';

const ExactDecimal = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_EVEN });

export type WakalaSurplusPolicy = 'BANK_PERFORMANCE_INCENTIVE' | 'RETURN_TO_MANDANT';

export interface WakalaFeeWaiver {
  amount: string;
  rationale: string;
  approved: boolean;
}

export interface WakalaAllocationInput {
  mandateId: string;
  realizedProfit: string;
  indicativeExpectedProfit: string;
  contractualFee: string;
  feeWaiver?: WakalaFeeWaiver;
  surplusPolicy: WakalaSurplusPolicy;
  performanceIncentiveRate: string;
  bankFaultEstablished?: boolean;
  lossCause?: LossCause;
  currencyScale?: number;
}

export interface WakalaAllocationResult {
  mandateId: string;
  performance: 'LOSS' | 'UNDERPERFORMANCE' | 'AT_OR_ABOVE_EXPECTATION';
  realizedProfit: string;
  indicativeExpectedProfit: string;
  contractualFee: string;
  waivedFee: string;
  chargedFee: string;
  performanceIncentive: string;
  mandantResult: string;
  bankTotalRemuneration: string;
  lossAttribution: 'NONE' | 'MANDANT' | 'BANK';
  conservationDifference: string;
}

export function allocateWakalaProfit(input: WakalaAllocationInput): WakalaAllocationResult {
  if (!input.mandateId.trim()) throw new TypeError('mandateId is required');
  const scale = input.currencyScale ?? 2;
  if (!Number.isInteger(scale) || scale < 0 || scale > 12) {
    throw new RangeError('currencyScale must be an integer between 0 and 12');
  }

  const realized = decimalToUnits(input.realizedProfit, scale, 'realizedProfit', true);
  const expected = decimalToUnits(input.indicativeExpectedProfit, scale, 'indicativeExpectedProfit');
  const contractualFee = decimalToUnits(input.contractualFee, scale, 'contractualFee');
  const incentiveRate = rate(input.performanceIncentiveRate, 'performanceIncentiveRate');
  if (incentiveRate.greaterThan(1)) throw new RangeError('performanceIncentiveRate cannot exceed 1');

  const waiver = input.feeWaiver === undefined ? 0n : decimalToUnits(input.feeWaiver.amount, scale, 'feeWaiver.amount');
  if (waiver > contractualFee) throw new RangeError('feeWaiver.amount cannot exceed contractualFee');
  if (waiver > 0n && (!input.feeWaiver?.approved || !input.feeWaiver.rationale.trim())) {
    throw new TypeError('A fee waiver must be approved and documented');
  }

  if (realized < 0n) {
    const attributedToBank = input.lossCause === undefined
      ? input.bankFaultEstablished === true
      : isBankLiabilityCause(input.lossCause);
    return {
      mandateId: input.mandateId,
      performance: 'LOSS',
      realizedProfit: unitsToDecimal(realized, scale),
      indicativeExpectedProfit: unitsToDecimal(expected, scale),
      contractualFee: unitsToDecimal(contractualFee, scale),
      waivedFee: unitsToDecimal(contractualFee, scale),
      chargedFee: unitsToDecimal(0n, scale),
      performanceIncentive: unitsToDecimal(0n, scale),
      mandantResult: unitsToDecimal(attributedToBank ? 0n : realized, scale),
      bankTotalRemuneration: unitsToDecimal(attributedToBank ? realized : 0n, scale),
      lossAttribution: attributedToBank ? 'BANK' : 'MANDANT',
      conservationDifference: unitsToDecimal(0n, scale),
    };
  }

  const chargedFee = minimum(contractualFee - waiver, realized);
  const afterFee = realized - chargedFee;
  const surplus = afterFee > expected ? afterFee - expected : 0n;
  const incentive = input.surplusPolicy === 'BANK_PERFORMANCE_INCENTIVE'
    ? roundedProduct(surplus, incentiveRate)
    : 0n;
  const mandantResult = afterFee - incentive;
  const bankTotal = chargedFee + incentive;
  const difference = realized - mandantResult - bankTotal;
  if (difference !== 0n) throw new Error('Wakala allocation conservation invariant violated');

  return {
    mandateId: input.mandateId,
    performance: realized < expected ? 'UNDERPERFORMANCE' : 'AT_OR_ABOVE_EXPECTATION',
    realizedProfit: unitsToDecimal(realized, scale),
    indicativeExpectedProfit: unitsToDecimal(expected, scale),
    contractualFee: unitsToDecimal(contractualFee, scale),
    waivedFee: unitsToDecimal(waiver, scale),
    chargedFee: unitsToDecimal(chargedFee, scale),
    performanceIncentive: unitsToDecimal(incentive, scale),
    mandantResult: unitsToDecimal(mandantResult, scale),
    bankTotalRemuneration: unitsToDecimal(bankTotal, scale),
    lossAttribution: 'NONE',
    conservationDifference: unitsToDecimal(difference, scale),
  };
}

function decimalToUnits(value: string, scale: number, field: string, signed = false): bigint {
  const expression = signed ? /^(-?)(0|[1-9]\d*)(?:\.(\d+))?$/ : /^(0|[1-9]\d*)(?:\.(\d+))?$/;
  const match = expression.exec(value);
  if (!match) throw new TypeError(`${field} must be a canonical ${signed ? '' : 'non-negative '}decimal string`);
  const sign = signed ? match[1] : '';
  const integer = signed ? match[2] : match[1];
  const fraction = (signed ? match[3] : match[2]) ?? '';
  if (fraction.length > scale) throw new RangeError(`${field} exceeds currency scale ${scale}`);
  const units = BigInt(`${integer}${fraction.padEnd(scale, '0')}`);
  return sign === '-' ? -units : units;
}

function rate(value: string, field: string): Decimal {
  if (!/^(0|[1-9]\d*)(?:\.\d+)?$/.test(value)) throw new TypeError(`${field} must be a canonical non-negative decimal string`);
  return new ExactDecimal(value);
}

function roundedProduct(units: bigint, multiplier: Decimal): bigint {
  return BigInt(new ExactDecimal(units.toString()).times(multiplier).toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN).toFixed(0));
}

function minimum(left: bigint, right: bigint): bigint {
  return left < right ? left : right;
}

function unitsToDecimal(units: bigint, scale: number): string {
  const negative = units < 0n;
  const absolute = negative ? -units : units;
  const digits = absolute.toString().padStart(scale + 1, '0');
  const value = scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return negative ? `-${value}` : value;
}
