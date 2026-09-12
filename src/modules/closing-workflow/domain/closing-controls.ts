export interface ClosingControlCounts {
  pendingCbsBatches: number;
  failedCbsBatches: number;
  unapprovedCalculationRuns: number;
  approvedCalculationRuns: number;
  missingRequiredReconciliations?: number;
  unresolvedReconciliationDiscrepancies?: number;
}

export interface ClosingControlDecision {
  passed: boolean;
  blockers: readonly string[];
}

export function evaluateClosingControls(counts: ClosingControlCounts): ClosingControlDecision {
  for (const [name, value] of Object.entries(counts)) {
    if (!Number.isInteger(value) || value < 0) throw new TypeError(`Invalid closing control count: ${name}`);
  }
  const blockers: string[] = [];
  if (counts.pendingCbsBatches > 0) blockers.push('CBS_BATCHES_PENDING');
  if (counts.failedCbsBatches > 0) blockers.push('CBS_BATCHES_FAILED');
  if (counts.unapprovedCalculationRuns > 0) blockers.push('CALCULATIONS_NOT_APPROVED');
  if (counts.approvedCalculationRuns === 0) blockers.push('NO_APPROVED_CALCULATION');
  if ((counts.missingRequiredReconciliations ?? 0) > 0) blockers.push('REQUIRED_RECONCILIATIONS_MISSING');
  if ((counts.unresolvedReconciliationDiscrepancies ?? 0) > 0) blockers.push('RECONCILIATION_DISCREPANCIES_OPEN');
  return { passed: blockers.length === 0, blockers };
}
