import { Money } from '../../../shared-kernel/money.js';

export function reconcileAmounts(
  subledgerAmount: string, generalLedgerAmount: string, currency: string, scale: number,
) {
  const subledger = Money.parse(subledgerAmount, currency, scale);
  const generalLedger = Money.parse(generalLedgerAmount, currency, scale);
  const difference = subledger.subtract(generalLedger).toDecimalString();
  return { difference, state: difference === Money.parse('0', currency, scale).toDecimalString()
    ? 'MATCHED' as const : 'VARIANCE' as const };
}
