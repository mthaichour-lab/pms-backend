import { describe, expect, it } from 'vitest';
import { ComplianceReference, compliancePriority } from '../../../src/modules/products/domain/compliance-reference.js';

describe('ComplianceReference', () => {
  it('is versioned, dated and evaluates its effective period', () => {
    const reference = ComplianceReference.create({ referenceId:'018f97ce-1186-4d7d-8e43-29f68d61b7b1', source:'BA', referenceCode:'BA-2026/01', version:'2', title:'Instruction participative', effectiveFrom:'2026-01-01', effectiveTo:'2026-12-31', createdBy:'compliance-1' });
    expect(reference.isEffectiveOn('2026-08-29')).toBe(true);
    expect(reference.isEffectiveOn('2027-01-01')).toBe(false);
  });

  it('rejects calendar dates normalized by JavaScript', () => {
    expect(() => ComplianceReference.create({ referenceId:'018f97ce-1186-4d7d-8e43-29f68d61b7b1', source:'BA', referenceCode:'BA-2026/01', version:'2', title:'Instruction participative', effectiveFrom:'2026-02-30', createdBy:'compliance-1' })).toThrow('invalid');
  });
  it('enforces source priority', () => {
    expect(compliancePriority('BA')).toBeGreaterThan(compliancePriority('SHARIA_COMMITTEE'));
    expect(compliancePriority('SHARIA_COMMITTEE')).toBeGreaterThan(compliancePriority('AAOIFI'));
    expect(compliancePriority('AAOIFI')).toBeGreaterThan(compliancePriority('IFSB'));
  });
});
