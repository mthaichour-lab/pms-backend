import { Module } from '@nestjs/common';

import { PostgresCalculationRunQueryRepository } from '../../../../src/infrastructure/persistence/postgres-calculation-run-query.repository.js';
import { GetCalculationRun } from '../../../../src/modules/profit-calculation/application/get-calculation-run.js';
import { PostgresDatabaseService } from '../database/postgres-database.service.js';
import { CalculationsController } from './calculations.controller.js';
import { GET_CALCULATION_RUN } from './calculations.tokens.js';
import { SOLVE_QUOTATION } from './calculations.tokens.js';
import { SolveQuotation } from '../../../../src/modules/profit-calculation/application/solve-quotation.js';
import { SimulationsController } from './simulations.controller.js';
import { PostgresQuotationBasisRepository } from '../../../../src/infrastructure/persistence/postgres-quotation-basis.repository.js';

@Module({
  controllers: [CalculationsController,SimulationsController],
  providers: [{
    provide: GET_CALCULATION_RUN,
    inject: [PostgresDatabaseService],
    useFactory: (database: PostgresDatabaseService) =>
      new GetCalculationRun(new PostgresCalculationRunQueryRepository(database.pool)),
  },{provide:SOLVE_QUOTATION,inject:[PostgresDatabaseService],useFactory:(database:PostgresDatabaseService)=>new SolveQuotation(new PostgresQuotationBasisRepository(database.pool))}],
})
export class CalculationsModule {}
