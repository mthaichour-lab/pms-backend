import { Module } from '@nestjs/common';

import { PostgresInvestmentAccountQueryRepository } from '../../../../src/infrastructure/persistence/postgres-investment-account-query.repository.js';
import { GetInvestmentAccountSnapshot } from '../../../../src/modules/investment-accounts/application/get-investment-account-snapshot.js';
import { PostgresDatabaseService } from '../database/postgres-database.service.js';
import { InvestmentAccountsController } from './investment-accounts.controller.js';
import { GET_INVESTMENT_ACCOUNT_SNAPSHOT } from './investment-accounts.tokens.js';

@Module({
  controllers: [InvestmentAccountsController],
  providers: [{
    provide: GET_INVESTMENT_ACCOUNT_SNAPSHOT,
    inject: [PostgresDatabaseService],
    useFactory: (database: PostgresDatabaseService) => new GetInvestmentAccountSnapshot(
      new PostgresInvestmentAccountQueryRepository(database.pool),
    ),
  }],
})
export class InvestmentAccountsModule {}
