import { Module } from '@nestjs/common';
import { PostgresDcrRepository } from '../../../../src/infrastructure/persistence/postgres-dcr.repository.js';
import { CalculateDcr } from '../../../../src/modules/risk-alm/application/calculate-dcr.js';
import { RunStressScenario } from '../../../../src/modules/risk-alm/application/run-stress-scenario.js';
import { PostgresStressScenarioRepository } from '../../../../src/infrastructure/persistence/postgres-stress-scenario.repository.js';
import { PostgresPublishedRiskDashboardRepository } from '../../../../src/infrastructure/persistence/postgres-published-risk-dashboard.repository.js';
import { GetPublishedRiskDashboard } from '../../../../src/modules/risk-alm/application/get-published-risk-dashboard.js';
import { PostgresDatabaseService } from '../database/postgres-database.service.js';
import { RiskAlmController } from './risk-alm.controller.js';
import { CALCULATE_DCR, GET_PUBLISHED_RISK_DASHBOARD, RUN_STRESS_SCENARIO } from './risk-alm.tokens.js';

@Module({
  controllers: [RiskAlmController],
  providers: [
    { provide: CALCULATE_DCR, inject: [PostgresDatabaseService], useFactory: (database: PostgresDatabaseService) => new CalculateDcr(new PostgresDcrRepository(database.pool)) },
    { provide: RUN_STRESS_SCENARIO, inject: [PostgresDatabaseService], useFactory: (database: PostgresDatabaseService) => new RunStressScenario(new PostgresStressScenarioRepository(database.pool)) },
    { provide: GET_PUBLISHED_RISK_DASHBOARD, inject: [PostgresDatabaseService], useFactory: (database: PostgresDatabaseService) => new GetPublishedRiskDashboard(new PostgresPublishedRiskDashboardRepository(database.pool)) },
  ],
})
export class RiskAlmModule {}
