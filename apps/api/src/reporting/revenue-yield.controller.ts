import { BadRequestException, ConflictException, Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { QueryRevenueYieldReport } from '../../../../src/modules/reporting/application/query-revenue-yield-report.js';
import { RequireAuthorization } from '../authorization/authorization.decorator.js';
import { QUERY_REVENUE_YIELD_REPORT } from './reporting.tokens.js';

@Controller('reporting/revenue-yields')
export class RevenueYieldController {
  constructor(@Inject(QUERY_REVENUE_YIELD_REPORT) private readonly report: QueryRevenueYieldReport) {}

  @Get(':poolId')
  @RequireAuthorization({
    operationType: 'READ_REVENUE_YIELD_REPORT',
    allowedRoles: ['FINANCE_ANALYST', 'FINANCE_CONTROLLER', 'SHARIA_AUDITOR', 'SYSTEM_ADMIN'],
    requiredDelegationLevel: 1,
    sensitive: false,
  })
  async get(
    @Param('poolId') poolId: string,
    @Query('periodFrom') periodFrom: string,
    @Query('periodTo') periodTo: string,
  ) {
    try {
      return await this.report.execute(poolId, periodFrom, periodTo);
    } catch (error) {
      if (error instanceof TypeError) throw new BadRequestException(error.message);
      if (error instanceof Error) throw new ConflictException(error.message);
      throw error;
    }
  }
}
