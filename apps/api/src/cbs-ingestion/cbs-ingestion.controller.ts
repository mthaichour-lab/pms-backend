import { BadRequestException, Controller, Get, Inject, Query } from '@nestjs/common';
import { QueryDataQualityDashboard } from '../../../../src/modules/cbs-ingestion/application/query-data-quality-dashboard.js';
import { RequireAuthorization } from '../authorization/authorization.decorator.js';
import { QUERY_CBS_DATA_QUALITY } from './cbs-ingestion.tokens.js';

@Controller('cbs/data-quality')
export class CbsIngestionController {
  constructor(@Inject(QUERY_CBS_DATA_QUALITY) private readonly dashboard: QueryDataQualityDashboard) {}

  @Get('batches')
  @RequireAuthorization({ operationType: 'VIEW_CBS_DATA_QUALITY', allowedRoles: ['FINANCE_ANALYST', 'FINANCE_CONTROLLER', 'SYSTEM_ADMIN'], requiredDelegationLevel: 1 })
  async list(@Query('businessDate') businessDate?: string, @Query('state') state?: string, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    try { return await this.dashboard.execute({ businessDate, state, limit: optionalInteger(limit), offset: optionalInteger(offset) }); }
    catch (error) { if (error instanceof TypeError || error instanceof RangeError) throw new BadRequestException(error.message); throw error; }
  }
}

function optionalInteger(value?: string): number | undefined { return value === undefined ? undefined : Number(value); }
