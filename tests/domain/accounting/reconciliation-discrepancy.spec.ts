import{describe,expect,it}from'vitest';
import{discrepancyDeadline,validateDiscrepancy}from'../../../src/modules/accounting/domain/reconciliation-discrepancy.js';
describe('reconciliation discrepancy',()=>{
  it('sets severity-based resolution deadlines',()=>{expect(discrepancyDeadline('2026-08-30T10:00:00Z','CRITICAL')).toBe('2026-08-30T12:00:00.000Z');expect(discrepancyDeadline('2026-08-30T10:00:00Z','LOW')).toBe('2026-09-02T10:00:00.000Z');});
  it('requires explicit evidence for accepted risk',()=>{expect(()=>validateDiscrepancy({ownerId:'finance',cause:'Known timing',correctiveAction:'Monitor settlement',status:'ACCEPTED_RISK'})).toThrow('explicit reference');});
});
