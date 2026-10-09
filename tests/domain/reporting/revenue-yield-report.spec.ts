import{describe,expect,it}from'vitest';import{buildRevenueYieldReport}from'../../../src/modules/reporting/domain/revenue-yield-report.js';
describe('revenue yield report',()=>{
 it('groups revenue by GL account and by maturity bucket, rated against the pool capital base',()=>{
  const report=buildRevenueYieldReport('GLOBAL_POOL','DZD','2026-08-01','2026-08-31','10000','2026-08-31',[
   {glAccountCode:'REV:MURABAHA',amount:'250',cashStatus:'RECEIVED',maturityDate:'2026-09-15'},
   {glAccountCode:'REV:MURABAHA',amount:'50',cashStatus:'ACCRUED',maturityDate:'2026-09-20'},
   {glAccountCode:'REV:IJARA',amount:'100',cashStatus:'RECEIVED',maturityDate:'2026-11-20'},
  ]);
  expect(report.capitalBase).toBe('10000.000000000000');
  expect(report.byGlAccount).toEqual([
   {glAccountCode:'REV:IJARA',receivedAmount:'100.000000000000',accruedAmount:'0.000000000000',receivedRatePercent:'1.000000',recognizedRatePercent:'1.000000'},
   {glAccountCode:'REV:MURABAHA',receivedAmount:'250.000000000000',accruedAmount:'50.000000000000',receivedRatePercent:'2.500000',recognizedRatePercent:'3.000000'},
  ]);
  const oneMonth=report.byMaturityBucket.find(bucket=>bucket.bucket==='1M');
  expect(oneMonth).toEqual({bucket:'1M',receivedAmount:'250.000000000000',accruedAmount:'50.000000000000',receivedRatePercent:'2.500000',recognizedRatePercent:'3.000000'});
  const threeMonths=report.byMaturityBucket.find(bucket=>bucket.bucket==='3M');
  expect(threeMonths).toEqual({bucket:'3M',receivedAmount:'100.000000000000',accruedAmount:'0.000000000000',receivedRatePercent:'1.000000',recognizedRatePercent:'1.000000'});
 });
 it('reports a zero rate when the capital base is zero',()=>{
  const report=buildRevenueYieldReport('EMPTY_POOL','DZD','2026-08-01','2026-08-31','0','2026-08-31',[{glAccountCode:'REV:MURABAHA',amount:'10',cashStatus:'RECEIVED'}]);
  expect(report.byGlAccount[0]).toMatchObject({receivedRatePercent:'0.000000',recognizedRatePercent:'0.000000'});
 });
});
