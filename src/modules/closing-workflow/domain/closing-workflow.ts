export const CLOSING_STEPS = [
  'PERIOD_OPENING','SCOPE_FREEZE','DATA_IMPORT','QUALITY_CONTROLS','RECONCILIATIONS','ASSET_VALIDATION',
  'PROVISIONAL_CALCULATION','EXCEPTION_HANDLING','RESERVE_DCR_SIMULATIONS','FINANCE_VALIDATION',
  'RISK_ALM_VALIDATION','SHARIA_COMPLIANCE_CONTROL','DELEGATED_APPROVAL','RUN_LOCKING','JOURNAL_GENERATION',
  'CORE_BANKING_CREDIT','POST_PAYMENT_RECONCILIATION','STATEMENT_PRODUCTION','EVIDENCE_ARCHIVING',
] as const;
export type ClosingStep=typeof CLOSING_STEPS[number];
export type ClosingWorkflowStatus='DRAFT'|'FED'|'ANOMALY'|'RECONCILED'|'CALCULATED'|'IN_VALIDATION'|'APPROVED'|'ACCOUNTED'|'PAID'|'CLOSED'|'CANCELLED'|'CORRECTED_BY_SUPPLEMENTARY_RUN';
export interface ClosingWorkflowState{currentStep:ClosingStep;status:ClosingWorkflowStatus;cancelled?:boolean;}
export interface ClosingQualityEvidence{qualityControlsGreen:boolean;blockingAnomalyIds:readonly string[];acceptedRiskReferences:readonly string[];}
export interface ClosingTransitionResult extends ClosingWorkflowState{stepNumber:number;previousStep:ClosingStep;}

const STATUS_BY_STEP:readonly ClosingWorkflowStatus[]=['DRAFT','DRAFT','FED','FED','RECONCILED','RECONCILED','CALCULATED','CALCULATED','CALCULATED','IN_VALIDATION','IN_VALIDATION','IN_VALIDATION','APPROVED','APPROVED','ACCOUNTED','PAID','PAID','PAID','CLOSED'];

export function advanceClosingWorkflow(state:ClosingWorkflowState,targetStep:ClosingStep,evidence:ClosingQualityEvidence):ClosingTransitionResult{
  if(state.cancelled||state.status==='CANCELLED'||state.status==='CLOSED')throw new Error(`Closing workflow cannot advance from ${state.status}`);
  const current=CLOSING_STEPS.indexOf(state.currentStep),target=CLOSING_STEPS.indexOf(targetStep);
  if(current<0||target<0)throw new TypeError('Unknown closing workflow step');
  if(target!==current+1)throw new Error('Closing workflow cannot skip or repeat a step');
  if(target>=CLOSING_STEPS.indexOf('PROVISIONAL_CALCULATION'))assertQualityEvidence(evidence);
  return{currentStep:targetStep,status:STATUS_BY_STEP[target],stepNumber:target+1,previousStep:state.currentStep};
}

export function markClosingAnomaly(state:ClosingWorkflowState):ClosingWorkflowState{
  if(state.status==='CLOSED'||state.status==='CANCELLED')throw new Error(`Closing anomaly cannot be recorded from ${state.status}`);
  return{...state,status:'ANOMALY'};
}

export function markSupplementaryCorrection(state:ClosingWorkflowState):ClosingWorkflowState{
  if(state.status!=='CLOSED')throw new Error('Only a closed workflow can be corrected by a supplementary run');
  return{...state,status:'CORRECTED_BY_SUPPLEMENTARY_RUN'};
}

function assertQualityEvidence(evidence:ClosingQualityEvidence):void{
  if(evidence.qualityControlsGreen)return;
  if(evidence.blockingAnomalyIds.length===0)return;
  const accepted=new Set(evidence.acceptedRiskReferences);
  if(evidence.blockingAnomalyIds.some(id=>!id.trim()||!accepted.has(id)))throw new Error('Provisional calculation requires green controls or documented acceptance of every blocking anomaly');
}
