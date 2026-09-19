import { Money } from '../../../shared-kernel/money.js';

export function reconcileAmounts(
  subledgerAmount: string, generalLedgerAmount: string, currency: string, scale: number,
) {
  const subledger = Money.parse(normalizeExactScale(subledgerAmount, scale), currency, scale);
  const generalLedger = Money.parse(normalizeExactScale(generalLedgerAmount, scale), currency, scale);
  const difference = subledger.subtract(generalLedger).toDecimalString();
  return { difference, state: difference === Money.parse('0', currency, scale).toDecimalString()
    ? 'MATCHED' as const : 'VARIANCE' as const };
}

function normalizeExactScale(amount: string, scale: number): string {
  const match = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?$/.exec(amount);
  if (!match) return amount;
  const fraction = match[3] ?? '';
  if (fraction.length <= scale) return amount;
  if (/[^0]/.test(fraction.slice(scale))) {
    throw new RangeError(`Money amount exceeds scale ${scale}`);
  }
  return scale === 0
    ? `${match[1]}${match[2]}`
    : `${match[1]}${match[2]}.${fraction.slice(0, scale)}`;
}
