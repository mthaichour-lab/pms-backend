import { BadRequestException, Body, ConflictException, Controller, Get, Headers, HttpCode, Inject, NotFoundException, Param, Post, Query } from '@nestjs/common';

import { GetCalculationRun, ListCalculationRuns, type CalculationRunView } from '../../../../src/modules/profit-calculation/application/get-calculation-run.js';
import {
  CalculationInitiationError,
  InitiateProfitCalculation,
  type InitiateCalculationRequest,
} from '../../../../src/modules/profit-calculation/application/initiate-profit-calculation.js';
import { GET_CALCULATION_RUN, INITIATE_PROFIT_CALCULATION, LIST_CALCULATION_RUNS } from './calculations.tokens.js';
import { AuthenticatedUser, type AuthenticatedUserClaims } from '../auth/authenticated-user.js';
import { RequireAuthorization } from '../authorization/authorization.decorator.js';

@Controller('calculations')
export class CalculationsController {
  constructor(
    @Inject(GET_CALCULATION_RUN) private readonly getRun: GetCalculationRun,
    @Inject(LIST_CALCULATION_RUNS) private readonly listRuns: ListCalculationRuns,
    @Inject(INITIATE_PROFIT_CALCULATION) private readonly initiateCalculation: InitiateProfitCalculation,
  ) {}

  @Get()
  @RequireAuthorization({operationType:'LIST_CALCULATION_RUNS',allowedRoles:['FINANCE_ANALYST','FINANCE_CONTROLLER','RISK_ANALYST','SYSTEM_ADMIN'],requiredDelegationLevel:1})
  listCalculations(@Query('limit')limit?:string,@Query('offset')offset?:string,@Query('poolId')poolId?:string,@Query('status')status?:CalculationRunView['status']) {
    try { return this.listRuns.execute({limit:parsePagination(limit,50,'limit'),offset:parsePagination(offset,0,'offset'),...(poolId?{poolId}:{}),...(status?{status}:{})}); }
    catch(error){if(error instanceof TypeError||error instanceof RangeError)throw new BadRequestException(error.message);throw error;}
  }

  @Post()
  @HttpCode(202)
  @RequireAuthorization({operationType:'RUN_PROFIT_CALCULATION',allowedRoles:['FINANCE_ANALYST','FINANCE_CONTROLLER','SYSTEM_ADMIN'],requiredDelegationLevel:2,sensitive:true})
  async runCalculation(
    @Body() body: Omit<InitiateCalculationRequest,'requestedBy'|'correlationId'>,
    @Headers('x-correlation-id') correlationId:string|undefined,
    @AuthenticatedUser() user:AuthenticatedUserClaims,
  ) {
    try{return await this.initiateCalculation.execute({...body,requestedBy:user.sub,correlationId:correlationId??''});}
    catch(error){
      if(error instanceof TypeError||error instanceof RangeError)throw new BadRequestException(error.message);
      if(error instanceof CalculationInitiationError)throw new ConflictException({
        code:error.code,message:error.message,requiredAction:error.requiredAction,
      });
      throw error;
    }
  }

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

function parsePagination(value:string|undefined,fallback:number,field:string):number{
  if(value===undefined)return fallback;
  if(!/^\d+$/.test(value))throw new BadRequestException(`${field} must be a non-negative integer`);
  return Number(value);
}
