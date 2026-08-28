import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RequireAuthorization } from '../authorization/authorization.decorator.js';
import { AppService } from './app.service.js';

interface PoolOperationBody {
  amount: string;
  currency: string;
  legalEntityId: string;
  branchId: string;
  workflowStatus: string;
  previousActorId?: string;
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData() {
    return this.appService.getData();
  }

  @Post('pools/:poolId/operations/approve')
  @RequireAuthorization({
    operationType: 'APPROVE_POOL_OPERATION',
    allowedRoles: ['FINANCE_CONTROLLER', 'SYSTEM_ADMIN'],
    allowedWorkflowStatuses: ['PENDING_APPROVAL'],
    requiredDelegationLevel: 2,
    sensitive: true,
  })
  approvePoolOperation(
    @Param('poolId') poolId: string,
    @Body() operation: PoolOperationBody,
  ) {
    return {
      poolId,
      status: 'APPROVED',
      amount: operation.amount,
      currency: operation.currency,
    };
  }
}
