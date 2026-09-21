import { Module } from '@nestjs/common';

import { PostgresInvestmentAccountQueryRepository } from '../../../../src/infrastructure/persistence/postgres-investment-account-query.repository.js';
import { GetInvestmentAccountSnapshot } from '../../../../src/modules/investment-accounts/application/get-investment-account-snapshot.js';
import { PostgresDatabaseService } from '../database/postgres-database.service.js';
import { InvestmentAccountsController } from './investment-accounts.controller.js';
import { GET_INVESTMENT_ACCOUNT_SNAPSHOT } from './investment-accounts.tokens.js';
import { MANAGE_INVESTMENT_SUBSCRIPTION } from './investment-accounts.tokens.js';
import { PostgresInvestmentSubscriptionRepository } from '../../../../src/infrastructure/persistence/postgres-investment-subscription.repository.js';
import { PostgresCustomerProfileRepository } from '../../../../src/infrastructure/persistence/postgres-customer-profile.repository.js';
import { ManageInvestmentSubscription } from '../../../../src/modules/investment-accounts/application/manage-investment-subscription.js';
import { ManageCustomerProfile } from '../../../../src/modules/customers/application/manage-customer-profile.js';
import { QueryInvestmentSubscriptions } from '../../../../src/modules/investment-accounts/application/query-investment-subscriptions.js';
import { QUERY_INVESTMENT_SUBSCRIPTIONS } from './investment-accounts.tokens.js';

@Module({
  controllers: [InvestmentAccountsController],
  providers: [{
    provide: QUERY_INVESTMENT_SUBSCRIPTIONS, inject: [PostgresDatabaseService],
    useFactory: (database: PostgresDatabaseService) => new QueryInvestmentSubscriptions(new PostgresInvestmentSubscriptionRepository(database.pool)),
  }, {
    provide: GET_INVESTMENT_ACCOUNT_SNAPSHOT,
    inject: [PostgresDatabaseService],
    useFactory: (database: PostgresDatabaseService) => new GetInvestmentAccountSnapshot(
      new PostgresInvestmentAccountQueryRepository(database.pool),
    ),
  },{
    provide: MANAGE_INVESTMENT_SUBSCRIPTION, inject: [PostgresDatabaseService],
    useFactory: (database: PostgresDatabaseService) => new ManageInvestmentSubscription(
      new PostgresInvestmentSubscriptionRepository(database.pool),
      new ManageCustomerProfile(new PostgresCustomerProfileRepository(database.pool)),
    ),
  }],
})
export class InvestmentAccountsModule {}
