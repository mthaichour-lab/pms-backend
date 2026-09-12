export const RECONCILIATION_TYPES=['ACCOUNTS_CBS','ASSETS_FINANCING','REVENUE_GL','SUBLEDGER_GL','CALCULATED_POSTED_PROFIT','PER_IRR_ACCOUNTING','PURIFICATION_DISBURSEMENT'] as const;
export type ReconciliationType=typeof RECONCILIATION_TYPES[number];
export type DiscrepancySeverity='LOW'|'MEDIUM'|'HIGH'|'CRITICAL';
export type DiscrepancyStatus='DETECTED'|'QUALIFIED'|'ASSIGNED'|'IN_PROGRESS'|'CORRECTED'|'CONTROLLED'|'CLOSED'|'ACCEPTED_RISK';

const maximumResolutionHours:Record<DiscrepancySeverity,number>={LOW:72,MEDIUM:24,HIGH:8,CRITICAL:2};
export function discrepancyDeadline(detectedAt:string,severity:DiscrepancySeverity):string{
  const timestamp=Date.parse(detectedAt);if(!Number.isFinite(timestamp))throw new TypeError('Detected date must be ISO');
  return new Date(timestamp+maximumResolutionHours[severity]*3_600_000).toISOString();
}
export function validateDiscrepancy(input:{ownerId:string;cause:string;correctiveAction:string;status:DiscrepancyStatus;riskAcceptanceReference?:string}){
  if(!input.ownerId.trim()||input.cause.trim().length<5||input.correctiveAction.trim().length<5)throw new TypeError('Discrepancy ownership, cause and corrective action are required');
  if(input.status==='ACCEPTED_RISK'&&!input.riskAcceptanceReference?.trim())throw new TypeError('Accepted discrepancy risk requires an explicit reference');
  return input;
}
