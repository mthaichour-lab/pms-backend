export type ExceptionStatus='DETECTED'|'QUALIFIED'|'ASSIGNED'|'IN_PROGRESS'|'CORRECTED'|'CONTROLLED'|'CLOSED'|'ACCEPTED_RISK';
export type ExceptionSeverity='LOW'|'MEDIUM'|'HIGH'|'CRITICAL';
const transitions:Record<ExceptionStatus,readonly ExceptionStatus[]>={
  DETECTED:['QUALIFIED'],QUALIFIED:['ASSIGNED'],ASSIGNED:['IN_PROGRESS'],IN_PROGRESS:['CORRECTED'],
  CORRECTED:['CONTROLLED'],CONTROLLED:['CLOSED','IN_PROGRESS','ACCEPTED_RISK'],CLOSED:[],ACCEPTED_RISK:[],
};
export function transitionException(current:ExceptionStatus,target:ExceptionStatus,evidence:{actorId:string;comment:string;riskAcceptanceReference?:string}){
  if(!transitions[current].includes(target))throw new Error(`Exception cannot transition from ${current} to ${target}`);
  if(!evidence.actorId.trim()||evidence.comment.trim().length<10)throw new TypeError('Exception transition requires actor and documented comment');
  if(target==='ACCEPTED_RISK'&&!evidence.riskAcceptanceReference?.trim())throw new TypeError('Risk acceptance reference is required');
  return{status:target,evidence:{...evidence,comment:evidence.comment.trim()}};
}
export function blocksPublication(severity:ExceptionSeverity,status:ExceptionStatus){
  return severity==='CRITICAL'&&!['CLOSED','ACCEPTED_RISK'].includes(status);
}
