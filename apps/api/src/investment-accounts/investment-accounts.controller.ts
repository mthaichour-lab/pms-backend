import { BadRequestException, Controller, Get, Inject, NotFoundException, Param, Query } from '@nestjs/common';

import { GetInvestmentAccountSnapshot } from '../../../../src/modules/investment-accounts/application/get-investment-account-snapshot.js';
import { GET_INVESTMENT_ACCOUNT_SNAPSHOT } from './investment-accounts.tokens.js';

@Controller('investment-accounts')
export class InvestmentAccountsController {
  constructor(
    @Inject(GET_INVESTMENT_ACCOUNT_SNAPSHOT)
    private readonly getSnapshot: GetInvestmentAccountSnapshot,
  ) {}

  @Get(':accountId')
  async getAccount(
    @Param('accountId') accountId: string,
    @Query('businessDate') businessDate: string | undefined,
  ) {
    if (!businessDate) throw new BadRequestException('businessDate is required');
    try {
      return await this.getSnapshot.execute(accountId, businessDate);
    } catch (error) {
      if (error instanceof TypeError) throw new BadRequestException(error.message);
      if (error instanceof Error && error.message.startsWith('Investment account not found')) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
