import { BadRequestException, Controller, Get, Inject, NotFoundException, Param, Query } from '@nestjs/common';

import { GetEffectiveCurrency } from '../../../../src/modules/reference-data/application/currency-reference.js';
import { GET_EFFECTIVE_CURRENCY } from './reference-data.tokens.js';

@Controller('reference-data/currencies')
export class ReferenceDataController {
  constructor(
    @Inject(GET_EFFECTIVE_CURRENCY)
    private readonly getEffectiveCurrency: GetEffectiveCurrency,
  ) {}

  @Get(':code')
  async getCurrency(
    @Param('code') code: string,
    @Query('businessDate') businessDate: string | undefined,
  ) {
    if (!businessDate) throw new BadRequestException('businessDate is required');
    try {
      return await this.getEffectiveCurrency.execute(code, businessDate);
    } catch (error) {
      if (error instanceof TypeError) throw new BadRequestException(error.message);
      if (error instanceof Error && error.message.startsWith('No effective currency')) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
