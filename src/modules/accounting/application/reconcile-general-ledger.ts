import { reconcileAmounts } from '../domain/reconciliation.js';
import { discrepancyDeadline, validateDiscrepancy, type DiscrepancySeverity } from '../domain/reconciliation-discrepancy.js';

export interface ReconciliationCommand {
  businessDate: string; currency: string; generalLedgerAmount: string;
  sourceReference: string; sourceChecksumSha256: string; actorId: string;
  correlationId?: string;
  discrepancy?: { severity: DiscrepancySeverity; ownerId: string; cause: string; correctiveAction: string; detectedAt: string };
}

export interface ReconciliationRepository {
  reconcileAtomically(command: ReconciliationCommand, compare: typeof reconcileAmounts): Promise<{
    reconciliationId: string; state: 'MATCHED' | 'VARIANCE'; difference: string; discrepancyId?: string;
  }>;
}

export class ReconcileGeneralLedger {
  constructor(private readonly repository: ReconciliationRepository) {}
  execute(command: ReconciliationCommand) {
    if (!isCalendarDate(command.businessDate)) throw new TypeError('Business date must use YYYY-MM-DD');
    if (!/^[A-Z]{3}$/.test(command.currency)) throw new TypeError('Currency must be an ISO uppercase code');
    if (!/^-?\d+(\.\d+)?$/.test(command.generalLedgerAmount)) throw new TypeError('General ledger amount must be decimal');
    const sourceReference = command.sourceReference.trim();
    if (sourceReference.length < 3 || sourceReference.length > 256) {
      throw new TypeError('Source reference must contain between 3 and 256 characters');
    }
    if (!/^[0-9a-f]{64}$/.test(command.sourceChecksumSha256)) throw new TypeError('Source checksum must be lowercase SHA-256');
    const actorId = command.actorId.trim();
    if (!actorId) throw new TypeError('Reconciliation actor is required');
    const correlationId = command.correlationId?.trim().toLowerCase();
    if (correlationId !== undefined && !isUuid(correlationId)) {
      throw new TypeError('Reconciliation correlation identifier must be a UUID');
    }
    let discrepancy = command.discrepancy;
    if (command.discrepancy) {
      discrepancyDeadline(command.discrepancy.detectedAt, command.discrepancy.severity);
      discrepancy = {
        ...command.discrepancy,
        ownerId: command.discrepancy.ownerId.trim(),
        cause: command.discrepancy.cause.trim(),
        correctiveAction: command.discrepancy.correctiveAction.trim(),
        detectedAt: new Date(command.discrepancy.detectedAt).toISOString(),
      };
      validateDiscrepancy({ ...discrepancy, status: 'DETECTED' });
    }
    return this.repository.reconcileAtomically({
      ...command, sourceReference, actorId, ...(correlationId ? { correlationId } : {}), ...(discrepancy ? { discrepancy } : {}),
    }, reconcileAmounts);
  }
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}
