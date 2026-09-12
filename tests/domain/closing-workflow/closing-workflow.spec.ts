import{describe,expect,it}from'vitest';
import{advanceClosingWorkflow,CLOSING_STEPS,markSupplementaryCorrection,type ClosingWorkflowState}from'../../../src/modules/closing-workflow/domain/closing-workflow.js';
const green={qualityControlsGreen:true,blockingAnomalyIds:[],acceptedRiskReferences:[]};
describe('19-step closing workflow',()=>{
  it('parcourt les 19 étapes sans saut avec un statut explicite',()=>{let state:ClosingWorkflowState={currentStep:CLOSING_STEPS[0],status:'DRAFT'};for(const target of CLOSING_STEPS.slice(1))state=advanceClosingWorkflow(state,target,green);expect(state).toMatchObject({currentStep:'EVIDENCE_ARCHIVING',status:'CLOSED',stepNumber:19});});
  it('interdit de sauter une étape',()=>{expect(()=>advanceClosingWorkflow({currentStep:'PERIOD_OPENING',status:'DRAFT'},'DATA_IMPORT',green)).toThrow('cannot skip');});
  it('bloque le calcul provisoire tant que chaque anomalie bloquante n’est pas acceptée',()=>{const state={currentStep:'ASSET_VALIDATION' as const,status:'RECONCILED' as const};expect(()=>advanceClosingWorkflow(state,'PROVISIONAL_CALCULATION',{qualityControlsGreen:false,blockingAnomalyIds:['ANO-1','ANO-2'],acceptedRiskReferences:['ANO-1']})).toThrow('every blocking anomaly');expect(advanceClosingWorkflow(state,'PROVISIONAL_CALCULATION',{qualityControlsGreen:false,blockingAnomalyIds:['ANO-1'],acceptedRiskReferences:['ANO-1']}).status).toBe('CALCULATED');});
  it('autorise une correction uniquement par run complémentaire après clôture',()=>{expect(markSupplementaryCorrection({currentStep:'EVIDENCE_ARCHIVING',status:'CLOSED'}).status).toBe('CORRECTED_BY_SUPPLEMENTARY_RUN');});
});
