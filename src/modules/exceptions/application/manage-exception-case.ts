import{transitionException,type ExceptionSeverity,type ExceptionStatus}from'../domain/exception-case.js';
export interface CreateExceptionCommand{sourceType:string;sourceId:string;resourceType:string;resourceId:string;severity:ExceptionSeverity;title:string;description:string;actorId:string;idempotencyKey:string;}
export interface TransitionExceptionCommand{exceptionId:string;targetStatus:ExceptionStatus;actorId:string;comment:string;riskAcceptanceReference?:string;idempotencyKey:string;}
export interface ExceptionCaseRepository{create(command:CreateExceptionCommand):Promise<{exceptionId:string;status:'DETECTED'}>;transition(command:TransitionExceptionCommand,decide:typeof transitionException):Promise<{status:ExceptionStatus}>;}
export class ManageExceptionCase{
  constructor(private readonly repository:ExceptionCaseRepository){}
  create(command:CreateExceptionCommand){for(const value of[command.sourceType,command.sourceId,command.resourceType,command.resourceId,command.actorId])if(!value.trim())throw new TypeError('Exception source, resource and actor are required');if(command.title.trim().length<5||command.description.trim().length<10)throw new TypeError('Exception title and description are required');if(command.idempotencyKey.length<16)throw new TypeError('Idempotency key must contain at least 16 characters');return this.repository.create(command);}
  transition(command:TransitionExceptionCommand){return this.repository.transition(command,transitionException);}
}
