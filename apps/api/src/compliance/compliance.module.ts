import { Module } from '@nestjs/common';
import { PostgresShariaReviewRepository } from '../../../../src/infrastructure/persistence/postgres-sharia-review.repository.js';
import { ManageShariaReview } from '../../../../src/modules/compliance/application/manage-sharia-review.js';
import { PostgresDatabaseService } from '../database/postgres-database.service.js';
import { ComplianceController } from './compliance.controller.js';
import { MANAGE_SHARIA_REVIEW } from './compliance.tokens.js';

@Module({
  controllers: [ComplianceController],
  providers: [{
    provide: MANAGE_SHARIA_REVIEW,
    inject: [PostgresDatabaseService],
    useFactory: (database: PostgresDatabaseService) =>
      new ManageShariaReview(new PostgresShariaReviewRepository(database.pool)),
  }],
})
export class ComplianceModule {}
