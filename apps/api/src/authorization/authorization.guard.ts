import type {
  AuthorizationPolicy,
  AuthorizationResource,
} from '../../../../src/shared-kernel/authorization-contracts.js';
import { randomUUID } from 'node:crypto';
import { evaluateAuthorization } from '../../../../src/modules/identity-access/domain/authorization.js';
import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedUserClaims } from '../auth/authenticated-user.js';
import { PUBLIC_ROUTE } from '../auth/public.decorator.js';
import { AUTHORIZATION_POLICY } from './authorization.decorator.js';
import { authorizationSubjectFromClaims } from './authorization-subject.js';
import { AUDIT_EVENT_WRITER, type AuditEventWriter } from '../audit/audit.tokens.js';
import { correlationFromHeader } from '../observability/correlation.middleware.js';

interface AuthorizationHttpRequest {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  user: AuthenticatedUserClaims;
  params?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
  ip?: string;
}

@Injectable()
export class AuthorizationGuard implements CanActivate {
  private readonly logger = new Logger(AuthorizationGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(AUDIT_EVENT_WRITER) private readonly audit: AuditEventWriter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()])) {
      return true;
    }
    const request = context
      .switchToHttp()
      .getRequest<AuthorizationHttpRequest>();
    const correlationId = request.headers['x-correlation-id'];
    if (typeof correlationId !== 'string' || correlationId.trim() === '') {
      throw new BadRequestException('X-Correlation-Id header is required');
    }

    const policy = this.reflector.getAllAndOverride<AuthorizationPolicy>(
      AUTHORIZATION_POLICY,
      [context.getHandler(), context.getClass()],
    );
    if (!policy) return true;
    if (policy.sensitive && !isSafeMethod(request.method)) {
      const idempotencyKey = request.headers['idempotency-key'];
      if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 16) {
        throw new BadRequestException(
          'Idempotency-Key header is required for sensitive operations',
        );
      }
    }

    const body = request.body ?? {};
    const resource: AuthorizationResource = {
      poolId: request.params?.['poolId'],
      legalEntityId: asOptionalString(body['legalEntityId']),
      branchId: asOptionalString(body['branchId']),
      workflowStatus: asOptionalString(body['workflowStatus']),
      previousActorId: asOptionalString(body['previousActorId']),
    };
    const amount = asOptionalString(body['amount']);
    const subject = authorizationSubjectFromClaims(request.user);
    this.signalReviewIfDue(subject, correlationId);
    const decision = evaluateAuthorization({
      subject,
      resource,
      policy,
      amount,
    });

    if (!decision.allowed) {
      this.logger.warn(
        JSON.stringify({
          event: 'authorization.denied',
          correlationId,
          userId: subject.userId,
          operationType: policy.operationType,
          poolId: resource.poolId,
          reasons: decision.reasons,
        }),
      );
      await this.recordDeniedAuthorization({
        correlationId: correlationFromHeader(correlationId),
        subject,
        policy,
        resource,
        reasons: decision.reasons,
        sessionId: typeof request.user.sid === 'string' ? request.user.sid : undefined,
        sourceAddress: request.ip,
      });
      throw new ForbiddenException({
        code: 'AUTHORIZATION_DENIED',
        reasons: decision.reasons,
        correlationId,
      });
    }

    return true;
  }

  private async recordDeniedAuthorization(input: {
    correlationId: string;
    subject: ReturnType<typeof authorizationSubjectFromClaims>;
    policy: AuthorizationPolicy;
    resource: AuthorizationResource;
    reasons: readonly string[];
    sessionId?: string;
    sourceAddress?: string;
  }): Promise<void> {
    const occurredAt = new Date().toISOString();
    try {
      await this.audit.append({
        auditEventId: randomUUID(),
        correlationId: input.correlationId,
        actorId: input.subject.userId,
        technicalIdentity: 'pms-api',
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        action: input.policy.operationType,
        resourceType: 'AuthorizationDecision',
        resourceId: authorizationResourceId(input.policy, input.resource),
        outcome: 'DENIED',
        businessDate: occurredAt.slice(0, 10),
        occurredAt,
        sourceApplication: 'pms-api',
        ...(input.sourceAddress ? { sourceAddress: input.sourceAddress } : {}),
        authorizedChanges: { decision: { allowed: false, reasons: input.reasons }, resource: input.resource },
      });
    } catch (error) {
      this.logger.error(JSON.stringify({ event: 'authorization.denied.audit_failed', correlationId: input.correlationId, operationType: input.policy.operationType, error: error instanceof Error ? error.message : 'unknown error' }));
    }
  }

  private signalReviewIfDue(
    subject: ReturnType<typeof authorizationSubjectFromClaims>,
    correlationId: string,
  ): void {
    if (!subject.accessReviewDueAt) return;
    const dueAt = Date.parse(subject.accessReviewDueAt);
    if (!Number.isFinite(dueAt) || Date.now() < dueAt) return;

    this.logger.warn(
      JSON.stringify({
        event: 'authorization.review_due',
        correlationId,
        userId: subject.userId,
        managerId: subject.accessManagerId,
        dueAt: subject.accessReviewDueAt,
      }),
    );
  }
}

function authorizationResourceId(policy: AuthorizationPolicy, resource: AuthorizationResource): string {
  return resource.poolId ?? resource.legalEntityId ?? resource.branchId ?? policy.operationType;
}

function isSafeMethod(method: string): boolean {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
