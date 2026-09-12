import { BadRequestException, Controller, Get, Inject, NotFoundException, Param } from '@nestjs/common';

import { GetCalculationRun } from '../../../../src/modules/profit-calculation/application/get-calculation-run.js';
import { GET_CALCULATION_RUN } from './calculations.tokens.js';

@Controller('calculations')
export class CalculationsController {
  constructor(@Inject(GET_CALCULATION_RUN) private readonly getRun: GetCalculationRun) {}

  @Get(':runId')
  async getCalculation(@Param('runId') runId: string) {
    try {
      return await this.getRun.execute(runId);
    } catch (error) {
      if (error instanceof TypeError) throw new BadRequestException(error.message);
      if (error instanceof Error && error.message.startsWith('Calculation run not found')) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
