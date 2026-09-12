import{describe,expect,it}from'vitest';import{blocksPublication,transitionException}from'../../../src/modules/exceptions/domain/exception-case.js';
describe('exception center',()=>{
  it('enforces the complete controlled lifecycle',()=>{expect(transitionException('DETECTED','QUALIFIED',{actorId:'controller',comment:'Cause initially qualified'}).status).toBe('QUALIFIED');expect(()=>transitionException('DETECTED','CLOSED',{actorId:'controller',comment:'Invalid direct closure'})).toThrow('cannot transition');});
  it('blocks only unresolved critical anomalies',()=>{expect(blocksPublication('CRITICAL','IN_PROGRESS')).toBe(true);expect(blocksPublication('CRITICAL','ACCEPTED_RISK')).toBe(false);expect(blocksPublication('HIGH','DETECTED')).toBe(false);});
  it('requires documented risk acceptance',()=>{expect(()=>transitionException('CONTROLLED','ACCEPTED_RISK',{actorId:'risk',comment:'Residual risk is accepted'})).toThrow('reference is required');});
});
