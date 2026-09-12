export type WorkflowAction = 'CONTROL_CALCULATION' | 'APPROVE_CALCULATION' | 'APPROVE_CLOSING' | 'REJECT_CLOSING';

export interface WorkflowApprovalCommand {
  action: WorkflowAction;
  resourceId: string;
  actorId: string;
  justification: string;
  idempotencyKey: string;
  correlationId: string;
  sessionId?: string;
}

export interface WorkflowApprovalRepository {
  transition(command: WorkflowApprovalCommand): Promise<{ state: string }>;
}

export class PerformWorkflowApproval {
  constructor(private readonly repository: WorkflowApprovalRepository) {}

  execute(command: WorkflowApprovalCommand) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(command.resourceId)) {
      throw new TypeError('Workflow resource identifier must be a UUID');
    }
    if (!command.actorId.trim()) throw new TypeError('Workflow actor is required');
    if (command.justification.trim().length < 10) throw new TypeError('Workflow justification must contain at least 10 characters');
    if (command.idempotencyKey.length < 16 || command.idempotencyKey.length > 128) {
      throw new TypeError('Workflow idempotency key must contain between 16 and 128 characters');
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(command.correlationId)) {
      throw new TypeError('Workflow correlation identifier must be a UUID');
    }
    return this.repository.transition({ ...command, justification: command.justification.trim() });
  }
}
