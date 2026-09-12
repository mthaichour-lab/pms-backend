import { assertBalancedJournal, type JournalLineDraft } from './balanced-journal.js';

export const ACCOUNTING_EVENT_TYPES = [
  'REVENUE', 'PROFIT_SHARE', 'PER_MOVEMENT', 'IRR_MOVEMENT', 'PURIFICATION',
  'WITHHOLDING_TAX', 'REMAINDER', 'CORRECTION',
] as const;
export type AccountingEventType = typeof ACCOUNTING_EVENT_TYPES[number];
export type AccountingAcknowledgementState = 'PENDING' | 'ACKNOWLEDGED' | 'REJECTED' | 'RETRIED' | 'REVERSED';

export interface AccountingSourceKey {
  runId: string;
  poolId: string;
  productId: string;
  eventType: AccountingEventType;
  eventId: string;
}

export function accountingSourceKey(source: AccountingSourceKey): string {
  for (const [name, value] of Object.entries(source)) {
    if (!value.trim()) throw new TypeError(`Accounting source ${name} is required`);
  }
  return `${source.runId}:${source.poolId}:${source.productId}:${source.eventType}:${source.eventId}`;
}

export function prepareAccountingEvent(
  source: AccountingSourceKey,
  entityId: string,
  lines: readonly JournalLineDraft[],
  scale: number,
) {
  if (!entityId.trim()) throw new TypeError('Accounting entity is required');
  assertBalancedJournal(lines, scale);
  return { sourceKey: accountingSourceKey(source), source, entityId, lines: [...lines] };
}

export function nextAcknowledgementState(
  current: AccountingAcknowledgementState,
  action: Exclude<AccountingAcknowledgementState, 'PENDING'>,
): AccountingAcknowledgementState {
  const allowed: Record<AccountingAcknowledgementState, readonly AccountingAcknowledgementState[]> = {
    PENDING: ['ACKNOWLEDGED', 'REJECTED'], ACKNOWLEDGED: [], REJECTED: ['RETRIED'],
    RETRIED: ['ACKNOWLEDGED', 'REJECTED', 'REVERSED'], REVERSED: [],
  };
  if (!allowed[current].includes(action)) throw new Error(`Accounting acknowledgement cannot transition from ${current} to ${action}`);
  return action;
}
