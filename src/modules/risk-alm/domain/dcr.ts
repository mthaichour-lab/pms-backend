import { Money } from '../../../shared-kernel/money.js';

export interface DcrInput {
  capitalDurationAmount: string;
  riskWeightedDurationAmount: string;
  currency: string;
  amountScale: number;
  threshold: string;
}

export interface DcrResult {
  value: string;
  threshold: string;
  state: 'WITHIN_LIMIT' | 'BREACH';
}

const RATIO_SCALE = 6;
const RATIO_FACTOR = 1_000_000n;

export function calculateDcr(input: DcrInput): DcrResult {
  const capital = Money.parse(input.capitalDurationAmount, input.currency, input.amountScale);
  const exposure = Money.parse(input.riskWeightedDurationAmount, input.currency, input.amountScale);
  if (capital.toMinorUnits() < 0n) throw new RangeError('Capital duration amount cannot be negative');
  if (exposure.toMinorUnits() <= 0n) throw new RangeError('Risk-weighted duration amount must be positive');
  const thresholdUnits = parseRatio(input.threshold);
  const numerator = capital.toMinorUnits() * RATIO_FACTOR;
  const quotient = numerator / exposure.toMinorUnits();
  const remainder = numerator % exposure.toMinorUnits();
  const valueUnits = remainder * 2n >= exposure.toMinorUnits() ? quotient + 1n : quotient;
  return {
    value: formatRatio(valueUnits),
    threshold: formatRatio(thresholdUnits),
    state: valueUnits >= thresholdUnits ? 'WITHIN_LIMIT' : 'BREACH',
  };
}

function parseRatio(value: string): bigint {
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) throw new TypeError('DCR threshold must be a non-negative decimal');
  const [whole = '0', fraction = ''] = value.split('.');
  if (fraction.length > RATIO_SCALE) throw new RangeError(`DCR threshold exceeds scale ${RATIO_SCALE}`);
  return BigInt(`${whole}${fraction.padEnd(RATIO_SCALE, '0')}`);
}

function formatRatio(units: bigint): string {
  const digits = units.toString().padStart(RATIO_SCALE + 1, '0');
  return `${digits.slice(0, -RATIO_SCALE)}.${digits.slice(-RATIO_SCALE)}`;
}
