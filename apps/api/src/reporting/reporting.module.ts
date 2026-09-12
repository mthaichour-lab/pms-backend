import { Module } from '@nestjs/common';
import { PostgresRegulatoryReportRepository } from '../../../../src/infrastructure/persistence/postgres-regulatory-report.repository.js';
import { ManageRegulatoryReport } from '../../../../src/modules/reporting/application/manage-regulatory-report.js';
import { PostgresDatabaseService } from '../database/postgres-database.service.js';
import { ReportingController } from './reporting.controller.js';
import { MANAGE_REGULATORY_REPORT } from './reporting.tokens.js';
import { QUERY_TENOR_YIELD_CURVE } from './reporting.tokens.js';
import { QueryTenorYieldCurve } from '../../../../src/modules/reporting/application/query-tenor-yield-curve.js';
import { PostgresTenorYieldCurveRepository } from '../../../../src/infrastructure/persistence/postgres-tenor-yield-curve.repository.js';
import { TenorCurveController } from './tenor-curve.controller.js';
import { ManagePlanningScenario } from '../../../../src/modules/reporting/application/manage-planning-scenario.js';
import { PostgresPlanningScenarioRepository } from '../../../../src/infrastructure/persistence/postgres-planning-scenario.repository.js';
import { PlanningScenarioController } from './planning-scenario.controller.js';
import { MANAGE_PLANNING_SCENARIO } from './reporting.tokens.js';
import { GENERATE_HISTORICAL_YIELD_FORECAST } from './reporting.tokens.js';
import { GenerateHistoricalYieldForecast } from '../../../../src/modules/reporting/application/generate-historical-yield-forecast.js';
import { PostgresHistoricalYieldForecastRepository } from '../../../../src/infrastructure/persistence/postgres-historical-yield-forecast.repository.js';
import { HistoricalForecastController } from './historical-forecast.controller.js';
import { QUERY_AUDIENCE_DASHBOARD } from './reporting.tokens.js';
import { QueryAudienceDashboard } from '../../../../src/modules/reporting/application/query-audience-dashboard.js';
import { PostgresAudienceDashboardRepository } from '../../../../src/infrastructure/persistence/postgres-audience-dashboard.repository.js';
import { AudienceDashboardController } from './audience-dashboard.controller.js';
import { QUERY_PROFIT_EXPLANATION } from './reporting.tokens.js';
import { QueryProfitExplanation } from '../../../../src/modules/reporting/application/query-profit-explanation.js';
import { PostgresProfitExplanationRepository } from '../../../../src/infrastructure/persistence/postgres-profit-explanation.repository.js';
import { ProfitExplanationController } from './profit-explanation.controller.js';
import { MANAGE_SECURE_EXPORT } from './reporting.tokens.js';
import { ManageSecureExport } from '../../../../src/modules/reporting/application/manage-secure-export.js';
import { PostgresSecureExportRepository } from '../../../../src/infrastructure/persistence/postgres-secure-export.repository.js';
import { SecureExportController } from './secure-export.controller.js';

@Module({
  controllers: [ReportingController,TenorCurveController,PlanningScenarioController,HistoricalForecastController,AudienceDashboardController,ProfitExplanationController,SecureExportController],
  providers: [{
    provide: MANAGE_REGULATORY_REPORT, inject: [PostgresDatabaseService],
    useFactory: (database: PostgresDatabaseService) =>
      new ManageRegulatoryReport(new PostgresRegulatoryReportRepository(database.pool)),
  },{provide:QUERY_TENOR_YIELD_CURVE,inject:[PostgresDatabaseService],useFactory:(database:PostgresDatabaseService)=>new QueryTenorYieldCurve(new PostgresTenorYieldCurveRepository(database.pool))},{provide:MANAGE_PLANNING_SCENARIO,inject:[PostgresDatabaseService],useFactory:(database:PostgresDatabaseService)=>new ManagePlanningScenario(new PostgresPlanningScenarioRepository(database.pool))},{provide:GENERATE_HISTORICAL_YIELD_FORECAST,inject:[PostgresDatabaseService],useFactory:(database:PostgresDatabaseService)=>new GenerateHistoricalYieldForecast(new PostgresHistoricalYieldForecastRepository(database.pool))},{provide:QUERY_AUDIENCE_DASHBOARD,inject:[PostgresDatabaseService],useFactory:(database:PostgresDatabaseService)=>new QueryAudienceDashboard(new PostgresAudienceDashboardRepository(database.pool))},{provide:QUERY_PROFIT_EXPLANATION,inject:[PostgresDatabaseService],useFactory:(database:PostgresDatabaseService)=>new QueryProfitExplanation(new PostgresProfitExplanationRepository(database.pool))},{provide:MANAGE_SECURE_EXPORT,inject:[PostgresDatabaseService],useFactory:(database:PostgresDatabaseService)=>new ManageSecureExport(new PostgresSecureExportRepository(database.pool))}],
})
export class ReportingModule {}
