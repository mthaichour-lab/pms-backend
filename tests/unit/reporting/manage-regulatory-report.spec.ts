import { describe, expect, it, vi } from 'vitest';
import { ManageRegulatoryReport } from '../../../src/modules/reporting/application/manage-regulatory-report.js';

describe('ManageRegulatoryReport', () => {
  it('delegates generation with a validated snapshot boundary', async () => {
    const generate = vi.fn(async (_input, validate) => ({
      regulatoryReportId: '17146c36-a0cb-4e0a-b095-60b67c945eb9', state: 'GENERATED' as const,
      snapshot: validate({ period: '2026-08', postedCalculationCount: 1,
        reconciliationVarianceCount: 0, dcrBreachCount: 0,
        approvedShariaReviewCount: 1, rejectedShariaReviewCount: 0 }),
      sourceChecksumSha256: 'a'.repeat(64), outputChecksumSha256: 'b'.repeat(64),
    }));
    const reports = new ManageRegulatoryReport({ generate, publish: vi.fn() });
    await expect(reports.generate('MONTHLY_CONTROL', '2026-08', 'generator')).resolves.toMatchObject({ state: 'GENERATED' });
    expect(generate).toHaveBeenCalledOnce();
  });

  it('rejects a short publication idempotency key', () => {
    const reports = new ManageRegulatoryReport({ generate: vi.fn(), publish: vi.fn() });
    expect(() => reports.publish({
      regulatoryReportId: '17146c36-a0cb-4e0a-b095-60b67c945eb9', actorId: 'publisher',
      evidenceDocumentId: 'a1d817e4-657f-475f-a96a-7eecb8f93acc',
      justification: 'Publication réglementaire contrôlée', idempotencyKey: 'short',
    })).toThrow('idempotency');
  });
});
