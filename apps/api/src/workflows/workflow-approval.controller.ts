import {
  BadRequestException, Body, ConflictException, Controller, Headers, Inject, Param, Post,
} from '@nestjs/common';

import { PerformWorkflowApproval, type WorkflowAction } from '../../../../src/modules/closing-workflow/application/perform-workflow-approval.js';
import { AuthenticatedUser, type AuthenticatedUserClaims } from '../auth/authenticated-user.js';
import { RequireAuthorization } from '../authorization/authorization.decorator.js';
import { PERFORM_WORKFLOW_APPROVAL } from './workflow-approval.tokens.js';

interface ApprovalBody { justification?: string }

@Controller()
export class WorkflowApprovalController {
  constructor(
    @Inject(PERFORM_WORKFLOW_APPROVAL)
    private readonly approval: PerformWorkflowApproval,
  ) {}

  @Post('calculations/:runId/control')
  @RequireAuthorization({
    operationType: 'CONTROL_CALCULATION', allowedRoles: ['FINANCE_CONTROLLER', 'SYSTEM_ADMIN'],
    requiredDelegationLevel: 2, sensitive: true,
  })
  controlCalculation(
    @Param('runId') runId: string,
    @Body() body: ApprovalBody,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @AuthenticatedUser() user: AuthenticatedUserClaims,
  ) {
    return this.perform('CONTROL_CALCULATION', runId, body, idempotencyKey, correlationId, user);
  }

  @Post('calculations/:runId/approve')
  @RequireAuthorization({
    operationType: 'APPROVE_CALCULATION', allowedRoles: ['FINANCE_CONTROLLER', 'SYSTEM_ADMIN'],
    requiredDelegationLevel: 2, sensitive: true,
  })
  approveCalculation(
    @Param('runId') runId: string,
    @Body() body: ApprovalBody,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @AuthenticatedUser() user: AuthenticatedUserClaims,
  ) {
    return this.perform('APPROVE_CALCULATION', runId, body, idempotencyKey, correlationId, user);
  }

  @Post('closings/:closingId/approve')
  @RequireAuthorization({
    operationType: 'APPROVE_CLOSING', allowedRoles: ['FINANCE_CONTROLLER', 'SYSTEM_ADMIN'],
    requiredDelegationLevel: 3, sensitive: true,
  })
  approveClosing(
    @Param('closingId') closingId: string,
    @Body() body: ApprovalBody,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @AuthenticatedUser() user: AuthenticatedUserClaims,
  ) {
    return this.perform('APPROVE_CLOSING', closingId, body, idempotencyKey, correlationId, user);
  }

  @Post('closings/:closingId/reject')
  @RequireAuthorization({
    operationType: 'REJECT_CLOSING', allowedRoles: ['FINANCE_CONTROLLER', 'SYSTEM_ADMIN'],
    requiredDelegationLevel: 3, sensitive: true,
  })
  rejectClosing(
    @Param('closingId') closingId: string,
    @Body() body: ApprovalBody,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @AuthenticatedUser() user: AuthenticatedUserClaims,
  ) {
    return this.perform('REJECT_CLOSING', closingId, body, idempotencyKey, correlationId, user);
  }

  private async perform(
    action: WorkflowAction,
    resourceId: string,
    body: ApprovalBody,
    idempotencyKey: string | undefined,
    correlationId: string | undefined,
    user: AuthenticatedUserClaims,
  ) {
    try {
      return await this.approval.execute({
        action, resourceId, actorId: user.sub,
        justification: body.justification ?? '', idempotencyKey: idempotencyKey ?? '',
        correlationId: correlationId ?? '',
        sessionId: typeof user.sid === 'string' ? user.sid : undefined,
      });
    } catch (error) {
      if (error instanceof TypeError) throw new BadRequestException(error.message);
      if (error instanceof Error) throw new ConflictException(error.message);
      throw error;
    }
  }
}
