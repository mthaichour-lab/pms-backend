import { Module } from '@nestjs/common';

import { PostgresCurrencyReferenceRepository } from '../../../../src/infrastructure/persistence/postgres-currency-reference.repository.js';
import { GetEffectiveCurrency } from '../../../../src/modules/reference-data/application/currency-reference.js';
import { GetEffectiveRegulatoryRule } from '../../../../src/modules/reference-data/application/regulatory-reference.js';
import { PostgresRegulatoryReferenceRepository } from '../../../../src/infrastructure/persistence/postgres-regulatory-reference.repository.js';
import { PostgresDatabaseService } from '../database/postgres-database.service.js';
import { ReferenceDataController } from './reference-data.controller.js';
import { RegulatoryReferenceController } from './regulatory-reference.controller.js';
import { GET_EFFECTIVE_CURRENCY, GET_EFFECTIVE_REGULATORY_RULE } from './reference-data.tokens.js';

@Module({
  controllers: [ReferenceDataController, RegulatoryReferenceController],
  providers: [
    {
      provide: GET_EFFECTIVE_CURRENCY,
      inject: [PostgresDatabaseService],
      useFactory: (database: PostgresDatabaseService) =>
        new GetEffectiveCurrency(new PostgresCurrencyReferenceRepository(database.pool)),
    },
    {
      provide: GET_EFFECTIVE_REGULATORY_RULE,
      inject: [PostgresDatabaseService],
      useFactory: (database: PostgresDatabaseService) =>
        new GetEffectiveRegulatoryRule(new PostgresRegulatoryReferenceRepository(database.pool)),
    },
  ],
})
export class ReferenceDataModule {}
