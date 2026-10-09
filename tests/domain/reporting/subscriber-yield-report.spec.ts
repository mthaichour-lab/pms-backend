import{describe,expect,it}from'vitest';import{buildSubscriberYieldReport}from'../../../src/modules/reporting/domain/subscriber-yield-report.js';
describe('subscriber yield report',()=>{
 it('classifies each subscriber by maturity bucket and reports its stored rates',()=>{
  const report=buildSubscriberYieldReport('2026-08-30',[
   {accountId:'a1',capitalInvested:'1000',allocatedProfit:'25',realizedRatePercent:'2.500000',distributedRatePercent:'2.500000',maturityDate:'2026-09-15'},
   {accountId:'a2',capitalInvested:'2000',allocatedProfit:'80',realizedRatePercent:'4.000000',distributedRatePercent:'4.000000',maturityDate:'2026-09-20'},
  ]);
  expect(report.subscribers).toEqual([
   {accountId:'a1',capitalInvested:'1000',allocatedProfit:'25',realizedRatePercent:'2.500000',distributedRatePercent:'2.500000',maturityDate:'2026-09-15',maturityBucket:'1M'},
   {accountId:'a2',capitalInvested:'2000',allocatedProfit:'80',realizedRatePercent:'4.000000',distributedRatePercent:'4.000000',maturityDate:'2026-09-20',maturityBucket:'1M'},
  ]);
  const oneMonth=report.byMaturityBucket.find(bucket=>bucket.bucket==='1M');
  expect(oneMonth).toEqual({bucket:'1M',subscriberCount:2,capitalInvested:'3000.000000000000',allocatedProfit:'105.000000000000',averageRatePercent:'3.500000'});
  const empty=report.byMaturityBucket.find(bucket=>bucket.bucket==='60M+');
  expect(empty).toEqual({bucket:'60M+',subscriberCount:0,capitalInvested:'0.000000000000',allocatedProfit:'0.000000000000',averageRatePercent:'0.000000'});
 });
 it('rejects an invalid business date',()=>{expect(()=>buildSubscriberYieldReport('30-08-2026',[])).toThrow('Business date')});
});
