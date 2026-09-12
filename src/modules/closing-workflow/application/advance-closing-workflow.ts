import{advanceClosingWorkflow,type ClosingQualityEvidence,type ClosingStep,type ClosingTransitionResult,type ClosingWorkflowState}from'../domain/closing-workflow.js';
export interface AdvanceClosingCommand{closingId:string;targetStep:ClosingStep;actorId:string;evidence:ClosingQualityEvidence;idempotencyKey:string;}
export interface ClosingWorkflowRepository{advanceAtomically(command:AdvanceClosingCommand,transition:(state:ClosingWorkflowState,target:ClosingStep,evidence:ClosingQualityEvidence)=>ClosingTransitionResult):Promise<ClosingTransitionResult>;}
export class AdvanceClosingWorkflow{
  constructor(private readonly repository:ClosingWorkflowRepository){}
  execute(command:AdvanceClosingCommand){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(command.closingId))throw new TypeError('closingId must be a UUID');if(!command.actorId.trim())throw new TypeError('Closing actor is required');if(command.idempotencyKey.length<16||command.idempotencyKey.length>128)throw new TypeError('Closing idempotency key must contain between 16 and 128 characters');return this.repository.advanceAtomically(command,advanceClosingWorkflow);}
}
