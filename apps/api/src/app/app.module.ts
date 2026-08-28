import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { OidcJwtGuard } from '../auth/oidc-jwt.guard.js';
import { AuthorizationGuard } from '../authorization/authorization.guard.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthController } from './health.controller.js';
import { CorrelationMiddleware } from '../observability/correlation.middleware.js';
import { ReferenceDataModule } from '../reference-data/reference-data.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { InvestmentAccountsModule } from '../investment-accounts/investment-accounts.module.js';

@Module({
  imports: [DatabaseModule, ReferenceDataModule, InvestmentAccountsModule],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: OidcJwtGuard },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
