import { BadRequestException, Body, ConflictException, Controller, Headers, Inject, Param, Post } from '@nestjs/common';
import { ManageRegulatoryReport } from '../../../../src/modules/reporting/application/manage-regulatory-report.js';
import { AuthenticatedUser, type AuthenticatedUserClaims } from '../auth/authenticated-user.js';
import { RequireAuthorization } from '../authorization/authorization.decorator.js';
import { MANAGE_REGULATORY_REPORT } from './reporting.tokens.js';

@Controller('reporting/regulatory-reports')
export class ReportingController {
  constructor(@Inject(MANAGE_REGULATORY_REPORT) private readonly reports: ManageRegulatoryReport) {}

  @Post('generate')
  @RequireAuthorization({ operationType: 'GENERATE_REGULATORY_REPORT', allowedRoles: ['FINANCE_CONTROLLER', 'RISK_ANALYST', 'SYSTEM_ADMIN'], requiredDelegationLevel: 2, sensitive: true })
  generate(
    @Body() body: { reportType?: string; period?: string },
    @AuthenticatedUser() user: AuthenticatedUserClaims,
  ) { return this.execute(() => this.reports.generate(body.reportType ?? '', body.period ?? '', user.sub)); }

  @Post(':regulatoryReportId/publish')
  @RequireAuthorization({ operationType: 'PUBLISH_REGULATORY_REPORT', allowedRoles: ['FINANCE_CONTROLLER', 'SYSTEM_ADMIN'], requiredDelegationLevel: 3, sensitive: true })
  publish(
    @Param('regulatoryReportId') regulatoryReportId: string,
    @Body() body: { evidenceDocumentId?: string; justification?: string },
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @AuthenticatedUser() user: AuthenticatedUserClaims,
  ) {
    return this.execute(() => this.reports.publish({
      regulatoryReportId, actorId: user.sub, evidenceDocumentId: body.evidenceDocumentId ?? '',
      justification: body.justification ?? '', idempotencyKey: idempotencyKey ?? '',
    }));
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) {
      if (error instanceof TypeError || error instanceof RangeError) throw new BadRequestException(error.message);
      if (error instanceof Error) throw new ConflictException(error.message);
      throw error;
    }
  }
}
