import { describe, expect, it } from 'vitest';
import { assertPublishableReport, validateRegulatoryReport } from '../../../src/modules/reporting/domain/regulatory-report.js';

describe('regulatory report', () => {
  it('accepts a deterministic monthly control snapshot', () => {
    expect(validateRegulatoryReport({
      period: '2026-08', postedCalculationCount: 12, reconciliationVarianceCount: 0,
      dcrBreachCount: 1, approvedShariaReviewCount: 4, rejectedShariaReviewCount: 1,
    }).dcrBreachCount).toBe(1);
  });
  it('enforces maker/checker and documentary evidence on publication', () => {
    expect(() => assertPublishableReport({
      state: 'GENERATED', generatorId: 'same', publisherId: 'same',
      evidenceDocumentId: '17146c36-a0cb-4e0a-b095-60b67c945eb9',
    })).toThrow('differ');
  });
});
