import{advanceClosingWorkflow,type ClosingQualityEvidence,type ClosingStep,type ClosingTransitionResult,type ClosingWorkflowState}from'../domain/closing-workflow.js';
export interface AdvanceClosingCommand{closingId:string;targetStep:ClosingStep;actorId:string;evidence:ClosingQualityEvidence;idempotencyKey:string;}
export interface ClosingWorkflowRepository{advanceAtomically(command:AdvanceClosingCommand,transition:(state:ClosingWorkflowState,target:ClosingStep,evidence:ClosingQualityEvidence)=>ClosingTransitionResult):Promise<ClosingTransitionResult>;}
export class AdvanceClosingWorkflow{
  constructor(private readonly repository:ClosingWorkflowRepository){}
  execute(command:AdvanceClosingCommand){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(command.closingId))throw new TypeError('closingId must be a UUID');const actorId=command.actorId.trim();if(!actorId)throw new TypeError('Closing actor is required');const idempotencyKey=command.idempotencyKey.trim();if(!/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey))throw new TypeError('Closing idempotency key must contain between 16 and 128 safe characters');return this.repository.advanceAtomically({...command,actorId,idempotencyKey},advanceClosingWorkflow);}
}
