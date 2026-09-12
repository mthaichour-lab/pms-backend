import { describe, expect, it } from 'vitest';
import { accountingSourceKey, nextAcknowledgementState, prepareAccountingEvent } from '../../../src/modules/accounting/domain/accounting-lifecycle.js';

const source={runId:'run-1',poolId:'pool-1',productId:'product-1',eventType:'REVENUE' as const,eventId:'event-1'};
describe('accounting event lifecycle',()=>{
  it('creates the complete stable source key and validates balance',()=>{
    expect(accountingSourceKey(source)).toBe('run-1:pool-1:product-1:REVENUE:event-1');
    expect(prepareAccountingEvent(source,'entity-1',[
      {accountCode:'REVENUE:ASSET',currency:'DZD',debit:'10.00',credit:'0'},
      {accountCode:'REVENUE:INCOME',currency:'DZD',debit:'0',credit:'10.00'},
    ],2).sourceKey).toContain('product-1');
  });
  it('enforces rejected then retried before reversal',()=>{
    expect(nextAcknowledgementState('PENDING','REJECTED')).toBe('REJECTED');
    expect(nextAcknowledgementState('REJECTED','RETRIED')).toBe('RETRIED');
    expect(nextAcknowledgementState('RETRIED','REVERSED')).toBe('REVERSED');
    expect(()=>nextAcknowledgementState('PENDING','REVERSED')).toThrow('cannot transition');
  });
});
