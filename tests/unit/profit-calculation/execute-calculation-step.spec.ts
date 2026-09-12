import{describe,expect,it,vi}from'vitest';
import{ExecuteCalculationStep}from'../../../src/modules/profit-calculation/application/execute-calculation-step.js';
describe('ExecuteCalculationStep',()=>{
  it('délègue le checkpoint idempotent',async()=>{const repository={executeOnce:vi.fn().mockResolvedValue({status:'COMPLETED',outputChecksumSha256:'b'.repeat(64)})};const operation=vi.fn().mockResolvedValue('b'.repeat(64));const service=new ExecuteCalculationStep(repository);const request={runId:'17146c36-a0cb-4e0a-b095-60b67c945eb9',stepName:'WEIGHTED_BASE',inputChecksumSha256:'a'.repeat(64)};await expect(service.execute(request,operation)).resolves.toEqual({status:'COMPLETED',outputChecksumSha256:'b'.repeat(64)});expect(repository.executeOnce).toHaveBeenCalledWith(request,operation);});
  it('bloque une empreinte invalide',()=>{const service=new ExecuteCalculationStep({executeOnce:vi.fn()});expect(()=>service.execute({runId:'17146c36-a0cb-4e0a-b095-60b67c945eb9',stepName:'WEIGHTED_BASE',inputChecksumSha256:'invalid'},vi.fn())).toThrow('must be SHA-256');});
});
