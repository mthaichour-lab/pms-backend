import { Money } from '../../../shared-kernel/money.js';

export interface JournalLineDraft {
  accountCode: string;
  currency: string;
  debit: string;
  credit: string;
  participantId?: string | null;
}

export function reverseJournalLines(
  lines: readonly JournalLineDraft[],
  scale: number,
): JournalLineDraft[] {
  assertBalancedJournal(lines, scale);
  const reversed = lines.map((line) => ({
    ...line,
    debit: line.credit,
    credit: line.debit,
  }));
  assertBalancedJournal(reversed, scale);
  return reversed;
}

export function assertBalancedJournal(lines: readonly JournalLineDraft[], scale: number): void {
  if (lines.length < 2) throw new TypeError('A journal requires at least two lines');
  const totals = new Map<string, { debit: Money; credit: Money }>();
  for (const line of lines) {
    if (!/^[A-Z0-9a-f:_-]{2,128}$/.test(line.accountCode)) throw new TypeError('Invalid ledger account code');
    const debit = Money.parse(line.debit, line.currency, scale);
    const credit = Money.parse(line.credit, line.currency, scale);
    const zero = Money.parse('0', line.currency, scale);
    const hasDebit = debit.compare(zero) > 0;
    const hasCredit = credit.compare(zero) > 0;
    if (hasDebit === hasCredit) throw new Error('Each journal line must contain exactly one positive side');
    const current = totals.get(line.currency) ?? { debit: zero, credit: zero };
    totals.set(line.currency, { debit: current.debit.add(debit), credit: current.credit.add(credit) });
  }
  for (const [currency, total] of totals) {
    if (total.debit.compare(total.credit) !== 0) throw new Error(`Journal is not balanced in ${currency}`);
  }
}

export function allocationJournalLines(
  allocations: readonly { participantId: string; amount: string; currency: string }[],
  distributableAmount: string,
  currency: string,
  scale: number,
): JournalLineDraft[] {
  const total = Money.parse(distributableAmount, currency, scale);
  const zero = Money.parse('0', currency, scale);
  const profit = total.compare(zero) >= 0;
  const lines: JournalLineDraft[] = [{
    accountCode: 'POOL:DISTRIBUTABLE', currency,
    debit: profit ? total.toDecimalString() : '0',
    credit: profit ? '0' : Money.fromMinorUnits(-total.toMinorUnits(), currency, scale).toDecimalString(),
  }];
  for (const allocation of allocations) {
    if (allocation.currency !== currency) throw new Error('Allocation currency differs from journal currency');
    const amount = Money.parse(allocation.amount, currency, scale);
    const absolute = amount.compare(zero) < 0
      ? Money.fromMinorUnits(-amount.toMinorUnits(), currency, scale).toDecimalString()
      : amount.toDecimalString();
    lines.push({
      accountCode: `INVESTMENT:${allocation.participantId}`,
      currency,
      debit: profit ? '0' : absolute,
      credit: profit ? absolute : '0',
    });
  }
  assertBalancedJournal(lines, scale);
  return lines;
}
