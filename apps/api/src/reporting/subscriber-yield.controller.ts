import { BadRequestException, ConflictException, Controller, Get, Inject, Param } from '@nestjs/common';
import { QuerySubscriberYieldReport } from '../../../../src/modules/reporting/application/query-subscriber-yield-report.js';
import { RequireAuthorization } from '../authorization/authorization.decorator.js';
import { QUERY_SUBSCRIBER_YIELD_REPORT } from './reporting.tokens.js';

@Controller('reporting/subscriber-yields')
export class SubscriberYieldController {
  constructor(@Inject(QUERY_SUBSCRIBER_YIELD_REPORT) private readonly report: QuerySubscriberYieldReport) {}

  @Get(':poolId')
  @RequireAuthorization({
    operationType: 'READ_SUBSCRIBER_YIELD_REPORT',
    allowedRoles: ['FINANCE_ANALYST', 'FINANCE_CONTROLLER', 'RELATIONSHIP_MANAGER', 'RISK_ANALYST', 'SYSTEM_ADMIN'],
    requiredDelegationLevel: 1,
    sensitive: true,
  })
  async get(@Param('poolId') poolId: string) {
    try {
      return await this.report.execute(poolId);
    } catch (error) {
      if (error instanceof TypeError) throw new BadRequestException(error.message);
      if (error instanceof Error) throw new ConflictException(error.message);
      throw error;
    }
  }
}
