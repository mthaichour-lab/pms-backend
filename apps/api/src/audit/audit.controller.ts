import { randomUUID } from 'node:crypto';
import { BadRequestException, Controller, Get, Headers, Inject, Query } from '@nestjs/common';
import type { AuthenticatedUserClaims } from '../auth/authenticated-user.js';
import { AuthenticatedUser } from '../auth/authenticated-user.js';
import { QueryAuditTrail } from '../../../../src/modules/audit/application/query-audit-trail.js';
import { RequireAuthorization } from '../authorization/authorization.decorator.js';
import { AUDIT_EVENT_WRITER, QUERY_AUDIT_TRAIL, type AuditEventWriter } from './audit.tokens.js';

interface AuditTrailQuery {
  limit?: string; action?: string; resourceType?: string; outcome?: 'SUCCESS' | 'DENIED' | 'FAILURE';
  correlationId?: string; businessDateFrom?: string; businessDateTo?: string;
}

@Controller('audit/events')
export class AuditController {
  constructor(
    @Inject(QUERY_AUDIT_TRAIL) private readonly audit: QueryAuditTrail,
    @Inject(AUDIT_EVENT_WRITER) private readonly events: AuditEventWriter,
  ) {}
  @Get()
  @RequireAuthorization({ operationType: 'READ_AUDIT_TRAIL', allowedRoles: ['FINANCE_CONTROLLER','RISK_ANALYST','SHARIA_AUDITOR','SYSTEM_ADMIN'], requiredDelegationLevel: 2, sensitive: true })
  async latest(
    @Query() query: AuditTrailQuery,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @AuthenticatedUser() user: AuthenticatedUserClaims,
  ) {
    try {
      if (query.limit !== undefined && !/^[1-9][0-9]{0,2}$/.test(query.limit)) throw new RangeError('Audit trail limit must be a decimal integer between 1 and 200');
      const limit = query.limit === undefined ? 50 : Number(query.limit);
      const filters = { action: query.action, resourceType: query.resourceType, outcome: query.outcome, correlationId: query.correlationId, businessDateFrom: query.businessDateFrom, businessDateTo: query.businessDateTo };
      const trail = await this.audit.execute(limit, filters);
      const occurredAt = new Date().toISOString();
      await this.events.append({
        auditEventId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        actorId: user.sub,
        technicalIdentity: 'pms-api',
        sessionId: typeof user.sid === 'string' ? user.sid : undefined,
        action: 'READ_AUDIT_TRAIL',
        resourceType: 'AuditTrail',
        resourceId: `latest:${limit}`,
        outcome: 'SUCCESS',
        businessDate: occurredAt.slice(0, 10),
        occurredAt,
        sourceApplication: 'pms-api',
        authorizedChanges: { filters },
      });
      return trail;
    }
    catch (error) { if (error instanceof TypeError || error instanceof RangeError) throw new BadRequestException(error.message); throw error; }
  }
}
