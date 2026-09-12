import { BadRequestException, Body, ConflictException, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { CalculateDcr } from '../../../../src/modules/risk-alm/application/calculate-dcr.js';
import { RunStressScenario } from '../../../../src/modules/risk-alm/application/run-stress-scenario.js';
import { GetPublishedRiskDashboard } from '../../../../src/modules/risk-alm/application/get-published-risk-dashboard.js';
import { AuthenticatedUser, type AuthenticatedUserClaims } from '../auth/authenticated-user.js';
import { RequireAuthorization } from '../authorization/authorization.decorator.js';
import { CALCULATE_DCR, GET_PUBLISHED_RISK_DASHBOARD, RUN_STRESS_SCENARIO } from './risk-alm.tokens.js';

@Controller('risk')
export class RiskAlmController {
  constructor(
    @Inject(CALCULATE_DCR) private readonly calculateDcr: CalculateDcr,
    @Inject(RUN_STRESS_SCENARIO) private readonly runStressScenario: RunStressScenario,
    @Inject(GET_PUBLISHED_RISK_DASHBOARD) private readonly getPublishedDashboard: GetPublishedRiskDashboard,
  ) {}

  @Get('dashboard/:poolId')
  @RequireAuthorization({ operationType: 'VIEW_RISK_DASHBOARD', allowedRoles: ['RISK_ANALYST', 'FINANCE_ANALYST', 'SYSTEM_ADMIN'], requiredDelegationLevel: 1, sensitive: true })
  async dashboard(@Param('poolId') poolId: string) {
    try { return await this.getPublishedDashboard.execute(poolId); }
    catch (error) {
      if (error instanceof TypeError || error instanceof RangeError) throw new BadRequestException(error.message);
      if (error instanceof Error) throw new ConflictException(error.message);
      throw error;
    }
  }

  @Post('dcr-calculations')
  @RequireAuthorization({ operationType: 'CALCULATE_DCR', allowedRoles: ['RISK_ANALYST', 'SYSTEM_ADMIN'], requiredDelegationLevel: 2, sensitive: true })
  async calculate(
    @Body() body: {
      poolId?: string; businessDate?: string; currency?: string;
      capitalDurationAmount?: string; riskWeightedDurationAmount?: string;
      threshold?: string; formulaVersion?: string; inputChecksumSha256?: string;
    },
    @AuthenticatedUser() user: AuthenticatedUserClaims,
  ) {
    try {
      return await this.calculateDcr.execute({
        poolId: body.poolId ?? '', businessDate: body.businessDate ?? '', currency: body.currency ?? '',
        capitalDurationAmount: body.capitalDurationAmount ?? '',
        riskWeightedDurationAmount: body.riskWeightedDurationAmount ?? '', threshold: body.threshold ?? '',
        formulaVersion: body.formulaVersion ?? '', inputChecksumSha256: body.inputChecksumSha256 ?? '',
        actorId: user.sub,
      });
    } catch (error) {
      if (error instanceof TypeError || error instanceof RangeError) throw new BadRequestException(error.message);
      if (error instanceof Error) throw new ConflictException(error.message);
      throw error;
    }
  }

  @Post('stress-scenarios')
  @RequireAuthorization({ operationType: 'RUN_STRESS_SCENARIO', allowedRoles: ['RISK_ANALYST', 'SYSTEM_ADMIN'], requiredDelegationLevel: 2, sensitive: true })
  async runStress(
    @Body() body: {
      scenarioCode?: string; businessDate?: string; currency?: string; baseAmount?: string;
      shocks?: readonly { bucket: string; basisPoints: number }[]; engineVersion?: string; inputChecksumSha256?: string;
    },
    @AuthenticatedUser() user: AuthenticatedUserClaims,
  ) {
    try {
      return await this.runStressScenario.execute({
        scenarioCode: body.scenarioCode ?? '', businessDate: body.businessDate ?? '',
        currency: body.currency ?? '', baseAmount: body.baseAmount ?? '', shocks: body.shocks ?? [],
        engineVersion: body.engineVersion ?? '', inputChecksumSha256: body.inputChecksumSha256 ?? '', actorId: user.sub,
      });
    } catch (error) {
      if (error instanceof TypeError || error instanceof RangeError) throw new BadRequestException(error.message);
      if (error instanceof Error) throw new ConflictException(error.message);
      throw error;
    }
  }
}
