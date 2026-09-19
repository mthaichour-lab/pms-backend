import {
  nextAcknowledgementState,
  prepareAccountingEvent,
  type AccountingAcknowledgementState,
  type AccountingSourceKey,
} from '../domain/accounting-lifecycle.js';
import type { JournalLineDraft } from '../domain/balanced-journal.js';

export interface EmitAccountingEventCommand extends AccountingSourceKey {
  entityId: string;
  businessDate: string;
  currencyScale: number;
  lines: readonly JournalLineDraft[];
  actorId: string;
  idempotencyKey: string;
}
export interface AcknowledgeAccountingEventCommand {
  journalEntryId: string;
  action: Exclude<AccountingAcknowledgementState, 'PENDING'>;
  externalReference: string;
  reason?: string;
  actorId: string;
  idempotencyKey: string;
}
export interface AccountingEventRepository {
  emitAtomically(command: EmitAccountingEventCommand, sourceKey: string): Promise<{ journalEntryId: string; acknowledgementState: 'PENDING' }>;
  acknowledgeAtomically(command: AcknowledgeAccountingEventCommand, decide: typeof nextAcknowledgementState): Promise<{ acknowledgementState: AccountingAcknowledgementState }>;
}

export class ManageAccountingEvent {
  constructor(private readonly repository: AccountingEventRepository) {}
  emit(command: EmitAccountingEventCommand) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(command.businessDate)) throw new TypeError('Business date must use YYYY-MM-DD');
    if (!command.actorId.trim()) throw new TypeError('Accounting actor is required');
    if (command.idempotencyKey.trim().length < 16) throw new TypeError('Idempotency key must contain at least 16 characters');
    const event = prepareAccountingEvent(command, command.entityId, command.lines, command.currencyScale);
    return this.repository.emitAtomically(command, event.sourceKey);
  }
  acknowledge(command: AcknowledgeAccountingEventCommand) {
    if (!command.externalReference.trim() || !command.actorId.trim()) throw new TypeError('Acknowledgement reference and actor are required');
    if (command.idempotencyKey.trim().length < 16) throw new TypeError('Idempotency key must contain at least 16 characters');
    if (!/^[0-9a-f-]{36}$/i.test(command.journalEntryId)) throw new TypeError('Journal entry identifier must be a UUID');
    if (command.action === 'REJECTED' && (command.reason?.trim().length ?? 0) < 10) {
      throw new TypeError('Accounting rejection requires a documented reason');
    }
    return this.repository.acknowledgeAtomically(command, nextAcknowledgementState);
  }
}
