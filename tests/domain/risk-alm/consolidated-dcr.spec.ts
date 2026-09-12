import { describe, expect, it, vi } from 'vitest';
import { calculateConsolidatedDcr } from '../../../src/modules/risk-alm/domain/consolidated-dcr.js';
import { executeFullEngineStressScenario } from '../../../src/modules/risk-alm/domain/stress-scenario.js';

describe('consolidated displaced commercial risk', () => {
  it('additionne reprises de réserves et tanazul dans le soutien volontaire', () => {
    expect(calculateConsolidatedDcr({
      theoreticalShareholderProfit:'200',reserveReleases:['10','5.50'],tanazulAmounts:['20','4.50'],
    })).toEqual({
      theoreticalShareholderProfit:'200.000000000000',reserveSupport:'15.500000000000',tanazulSupport:'24.500000000000',
      totalVoluntarySupport:'40.000000000000',consolidatedDcr:'0.200000000000',
    });
  });
});

describe('full engine stress rerun', () => {
  it('applique tous les chocs au snapshot puis relance le moteur exactement une fois', () => {
    const rerun=vi.fn((values:Readonly<Record<string,string>>)=>({profit:values.REVENUE,resources:values.RESOURCES}));
    const result=executeFullEngineStressScenario({
      sourceRunId:'17146c36-a0cb-4e0a-b095-60b67c945eb9',values:{REVENUE:'1000',RESOURCES:'2000',UNCHANGED:'50'},
    },[{bucket:'REVENUE',basisPoints:-1000},{bucket:'RESOURCES',basisPoints:500}],rerun);
    expect(rerun).toHaveBeenCalledTimes(1);
    expect(rerun).toHaveBeenCalledWith({REVENUE:'900.000000000000',RESOURCES:'2100.000000000000',UNCHANGED:'50'});
    expect(result.engineResult).toEqual({profit:'900.000000000000',resources:'2100.000000000000'});
    expect(result.outputChecksumSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
