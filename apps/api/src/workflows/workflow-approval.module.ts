import { Module } from '@nestjs/common';

import { PostgresWorkflowApprovalRepository } from '../../../../src/infrastructure/persistence/postgres-workflow-approval.repository.js';
import { PerformWorkflowApproval } from '../../../../src/modules/closing-workflow/application/perform-workflow-approval.js';
import { PostgresDatabaseService } from '../database/postgres-database.service.js';
import { WorkflowApprovalController } from './workflow-approval.controller.js';
import { PERFORM_WORKFLOW_APPROVAL } from './workflow-approval.tokens.js';

@Module({
  controllers: [WorkflowApprovalController],
  providers: [{
    provide: PERFORM_WORKFLOW_APPROVAL,
    inject: [PostgresDatabaseService],
    useFactory: (database: PostgresDatabaseService) =>
      new PerformWorkflowApproval(new PostgresWorkflowApprovalRepository(database.pool)),
  }],
})
export class WorkflowApprovalModule {}
