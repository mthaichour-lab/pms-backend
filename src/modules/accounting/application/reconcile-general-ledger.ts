import { reconcileAmounts } from '../domain/reconciliation.js';
import { discrepancyDeadline, validateDiscrepancy, type DiscrepancySeverity } from '../domain/reconciliation-discrepancy.js';

export interface ReconciliationCommand {
  businessDate: string; currency: string; generalLedgerAmount: string;
  sourceReference: string; sourceChecksumSha256: string; actorId: string;
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(command.businessDate)) throw new TypeError('Business date must use YYYY-MM-DD');
    if (!/^[A-Z]{3}$/.test(command.currency)) throw new TypeError('Currency must be an ISO uppercase code');
    if (!/^-?\d+(\.\d+)?$/.test(command.generalLedgerAmount)) throw new TypeError('General ledger amount must be decimal');
    if (command.sourceReference.trim().length < 3) throw new TypeError('Source reference is required');
    if (!/^[0-9a-f]{64}$/.test(command.sourceChecksumSha256)) throw new TypeError('Source checksum must be lowercase SHA-256');
    if (!command.actorId.trim()) throw new TypeError('Reconciliation actor is required');
    if (command.discrepancy) {
      validateDiscrepancy({ ...command.discrepancy, status: 'DETECTED' });
      discrepancyDeadline(command.discrepancy.detectedAt, command.discrepancy.severity);
    }
    return this.repository.reconcileAtomically({ ...command, sourceReference: command.sourceReference.trim() }, reconcileAmounts);
  }
}
