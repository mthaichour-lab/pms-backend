import { describe, expect, it } from 'vitest';
import { ProductTermsVersion } from '../../../src/modules/products/domain/product-terms-version.js';

const base = { termsVersionId: '550e8400-e29b-41d4-a716-446655440010', productId: '550e8400-e29b-41d4-a716-446655440001', version: 1, effectiveFrom: '2026-09-01', investorNisba: '70', bankNisba: '30', indicativeTargetRate: '4.5', createdBy: 'maker' };

describe('ProductTermsVersion', () => {
  it('requires a successful simulation before publication', () => {
    const terms = ProductTermsVersion.draft(base);
    expect(() => terms.publish({ businessDate: '2026-08-29', simulationChecksumSha256: 'invalid', actorId: 'checker' })).toThrow('simulation checksum');
    terms.publish({ businessDate: '2026-08-29', simulationChecksumSha256: 'a'.repeat(64), actorId: 'checker' });
    expect(terms.snapshot().status).toBe('PUBLISHED');
  });

  it('requires double approval for retroactive activation', () => {
    const terms = ProductTermsVersion.draft({ ...base, effectiveFrom: '2026-08-01' });
    expect(() => terms.publish({ businessDate: '2026-08-29', simulationChecksumSha256: 'b'.repeat(64), actorId: 'checker' })).toThrow('double approval');
    terms.publish({ businessDate: '2026-08-29', simulationChecksumSha256: 'b'.repeat(64), retroactiveApprovalId: '550e8400-e29b-41d4-a716-446655440020', actorId: 'checker' });
    expect(terms.snapshot().retroactiveApprovalId).toBeDefined();
  });

  it('enforces Maker-Checker separation', () => {
    const terms = ProductTermsVersion.draft(base);
    expect(() => terms.publish({ businessDate: '2026-08-29', simulationChecksumSha256: 'a'.repeat(64), actorId: 'maker' })).toThrow('independent checker');
  });

  it('rejects imbalanced Nisba and invalid effective ranges', () => {
    expect(() => ProductTermsVersion.draft({ ...base, bankNisba: '29.9' })).toThrow('total 100%');
    expect(() => ProductTermsVersion.draft({ ...base, effectiveTo: '2026-08-31' })).toThrow('cannot precede');
  });

  it('rejects calendar dates that do not exist', () => {
    expect(() => ProductTermsVersion.draft({ ...base, effectiveFrom: '2026-02-30' })).toThrow('Invalid effective date');
  });

  it('rejects restoration of published terms without simulation evidence', () => {
    expect(() => ProductTermsVersion.restore({ ...base, status: 'PUBLISHED' })).toThrow('simulation checksum');
  });
});
