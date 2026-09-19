import {
  BadRequestException, Body, ConflictException, Controller, Headers, Inject, Param, Post,
} from '@nestjs/common';

import {
  ManageSecureExport, type CreateSecureExportCommand,
} from '../../../../src/modules/reporting/application/manage-secure-export.js';
import type { ExportDataset } from '../../../../src/modules/reporting/domain/secure-export.js';
import { AuthenticatedUser, type AuthenticatedUserClaims } from '../auth/authenticated-user.js';
import { RequireAuthorization } from '../authorization/authorization.decorator.js';
import { MANAGE_SECURE_EXPORT } from './reporting.tokens.js';

@Controller('reporting/exports')
export class SecureExportController {
  constructor(@Inject(MANAGE_SECURE_EXPORT) private readonly exports: ManageSecureExport) {}

  @Post()
  @RequireAuthorization({
    operationType: 'CREATE_SECURE_EXPORT',
    allowedRoles: ['FINANCE_ANALYST', 'FINANCE_CONTROLLER', 'RISK_ANALYST', 'SHARIA_AUDITOR', 'SYSTEM_ADMIN'],
    requiredDelegationLevel: 1, sensitive: true,
  })
  create(
    @Body() body: Omit<CreateSecureExportCommand, 'requesterId' | 'idempotencyKey' | 'correlationId'>,
    @Headers('idempotency-key') key: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @AuthenticatedUser() user: AuthenticatedUserClaims,
  ) {
    return this.handle(() => this.exports.create({
      ...body, requesterId: user.sub, idempotencyKey: key ?? '', correlationId: correlationId ?? '',
    }));
  }

  @Post(':exportId/approvals')
  @RequireAuthorization({
    operationType: 'APPROVE_MASS_EXPORT', allowedRoles: ['FINANCE_CONTROLLER', 'SYSTEM_ADMIN'],
    requiredDelegationLevel: 4, sensitive: true,
  })
  approve(
    @Param('exportId') id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @AuthenticatedUser() user: AuthenticatedUserClaims,
  ) {
    return this.handle(() => this.exports.approve(id, user.sub, key ?? '', correlationId ?? ''));
  }

  @Post(':exportId/generation')
  @RequireAuthorization({
    operationType: 'GENERATE_SECURE_EXPORT',
    allowedRoles: ['FINANCE_ANALYST', 'FINANCE_CONTROLLER', 'RISK_ANALYST', 'SHARIA_AUDITOR', 'SYSTEM_ADMIN'],
    requiredDelegationLevel: 2, sensitive: true,
  })
  generate(
    @Param('exportId') id: string,
    @Body() body: { dataset?: ExportDataset },
    @Headers('idempotency-key') key: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @AuthenticatedUser() user: AuthenticatedUserClaims,
  ) {
    return this.handle(() => this.exports.generate(
      id, user.sub, body.dataset ?? { columns: [], rows: [] }, key ?? '', correlationId ?? '',
    ));
  }

  private async handle<T>(work: () => Promise<T>) {
    try {
      return await work();
    } catch (error) {
      if (error instanceof TypeError || error instanceof RangeError) throw new BadRequestException(error.message);
      if (error instanceof Error) throw new ConflictException(error.message);
      throw error;
    }
  }
}
