import { describe, expect, it } from 'vitest';
import { buildClosingEvidenceManifest } from '../../../src/modules/closing-workflow/domain/closing-governance.js';

describe('closing governance evidence', () => {
  it('builds a deterministic manifest and explicitly traces accepted risks', () => {
    const input = {
      closingId: 'closing-1', workflowStatus: 'CLOSED' as const,
      stepEventIds: ['step-b', 'step-a'], approvalActionIds: ['approval-1'], rejectionIds: [],
      acceptedRisks: [{ anomalyId: 'anomaly-1', acceptanceReference: 'RISK-2026-9', rationale: 'Residual risk approved' }],
      generatedAt: '2026-08-30T10:00:00.000Z',
    };
    const first = buildClosingEvidenceManifest(input);
    const second = buildClosingEvidenceManifest({ ...input, stepEventIds: ['step-a', 'step-b'] });
    expect(first.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(first.checksumSha256).toBe(second.checksumSha256);
    expect(first.acceptedRisks[0]?.acceptanceReference).toBe('RISK-2026-9');
  });

  it('rejects an undocumented accepted risk', () => {
    expect(() => buildClosingEvidenceManifest({
      closingId: 'closing-1', workflowStatus: 'CLOSED', stepEventIds: [], approvalActionIds: [], rejectionIds: [],
      acceptedRisks: [{ anomalyId: 'a', acceptanceReference: '', rationale: '' }], generatedAt: '2026-08-30T10:00:00Z',
    })).toThrow('Accepted risks require');
  });
});
