import { Module } from '@nestjs/common';

import { PostgresCurrencyReferenceRepository } from '../../../../src/infrastructure/persistence/postgres-currency-reference.repository.js';
import { GetEffectiveCurrency } from '../../../../src/modules/reference-data/application/currency-reference.js';
import { PostgresDatabaseService } from '../database/postgres-database.service.js';
import { ReferenceDataController } from './reference-data.controller.js';
import { GET_EFFECTIVE_CURRENCY } from './reference-data.tokens.js';

@Module({
  controllers: [ReferenceDataController],
  providers: [
    {
      provide: GET_EFFECTIVE_CURRENCY,
      inject: [PostgresDatabaseService],
      useFactory: (database: PostgresDatabaseService) =>
        new GetEffectiveCurrency(new PostgresCurrencyReferenceRepository(database.pool)),
    },
  ],
})
export class ReferenceDataModule {}
