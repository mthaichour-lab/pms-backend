import { describe, expect, it } from 'vitest';

import { evaluateClosingControls } from '../../../src/modules/closing-workflow/domain/closing-controls.js';

describe('closing controls', () => {
  it('passes only when ingestion is clean and at least one calculation is approved', () => {
    expect(evaluateClosingControls({
      pendingCbsBatches: 0, failedCbsBatches: 0,
      unapprovedCalculationRuns: 0, approvedCalculationRuns: 2,
    })).toEqual({ passed: true, blockers: [] });
  });

  it('returns every blocking control for remediation', () => {
    expect(evaluateClosingControls({
      pendingCbsBatches: 1, failedCbsBatches: 2,
      unapprovedCalculationRuns: 3, approvedCalculationRuns: 0,
    }).blockers).toEqual([
      'CBS_BATCHES_PENDING', 'CBS_BATCHES_FAILED',
      'CALCULATIONS_NOT_APPROVED', 'NO_APPROVED_CALCULATION',
    ]);
  });

  it('blocks closing when a required reconciliation is missing or unresolved',()=>{
    expect(evaluateClosingControls({pendingCbsBatches:0,failedCbsBatches:0,unapprovedCalculationRuns:0,approvedCalculationRuns:1,missingRequiredReconciliations:1,unresolvedReconciliationDiscrepancies:2}).blockers)
      .toEqual(['REQUIRED_RECONCILIATIONS_MISSING','RECONCILIATION_DISCREPANCIES_OPEN']);
  });
});
