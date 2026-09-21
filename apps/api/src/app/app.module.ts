import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { OidcJwtGuard } from '../auth/oidc-jwt.guard.js';
import { AuthorizationGuard } from '../authorization/authorization.guard.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthController } from './health.controller.js';
import { CorrelationMiddleware } from '../observability/correlation.middleware.js';
import { HttpMetricsRegistry } from '../observability/http-metrics.js';
import { MetricsController } from '../observability/metrics.controller.js';
import { ReferenceDataModule } from '../reference-data/reference-data.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { InvestmentAccountsModule } from '../investment-accounts/investment-accounts.module.js';
import { CalculationsModule } from '../calculations/calculations.module.js';
import { WorkflowApprovalModule } from '../workflows/workflow-approval.module.js';
import { AccountingModule } from '../accounting/accounting.module.js';
import { ComplianceModule } from '../compliance/compliance.module.js';
import { RiskAlmModule } from '../risk-alm/risk-alm.module.js';
import { ReportingModule } from '../reporting/reporting.module.js';
import { ProductsModule } from '../products/products.module.js';
import { TokenizationModule } from '../tokenization/tokenization.module.js';
import { CbsIngestionModule } from '../cbs-ingestion/cbs-ingestion.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import { PoolingModule } from '../pooling/pooling.module.js';
import { RevenueModule } from '../revenue/revenue.module.js';
import { ExceptionsModule } from '../exceptions/exceptions.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { UserAdministrationModule } from '../user-administration/user-administration.module.js';

@Module({
  imports: [
    DatabaseModule, ReferenceDataModule, InvestmentAccountsModule, UserAdministrationModule,
    CalculationsModule, WorkflowApprovalModule, AccountingModule, ComplianceModule, RiskAlmModule,
    ReportingModule, ProductsModule, TokenizationModule, CbsIngestionModule, CustomersModule, PoolingModule, RevenueModule, ExceptionsModule, DocumentsModule, AuditModule,
  ],
  controllers: [AppController, HealthController, MetricsController],
  providers: [
    AppService,
    HttpMetricsRegistry,
    { provide: APP_GUARD, useClass: OidcJwtGuard },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
