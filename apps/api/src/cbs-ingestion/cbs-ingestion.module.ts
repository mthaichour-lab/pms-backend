import { Module } from '@nestjs/common';
import { PostgresDataQualityDashboardRepository } from '../../../../src/infrastructure/persistence/postgres-data-quality-dashboard.repository.js';
import { QueryDataQualityDashboard } from '../../../../src/modules/cbs-ingestion/application/query-data-quality-dashboard.js';
import { PostgresDatabaseService } from '../database/postgres-database.service.js';
import { CbsIngestionController } from './cbs-ingestion.controller.js';
import { QUERY_CBS_DATA_QUALITY } from './cbs-ingestion.tokens.js';

@Module({ controllers: [CbsIngestionController], providers: [{
  provide: QUERY_CBS_DATA_QUALITY, inject: [PostgresDatabaseService],
  useFactory: (database: PostgresDatabaseService) => new QueryDataQualityDashboard(new PostgresDataQualityDashboardRepository(database.pool)),
}] })
export class CbsIngestionModule {}
