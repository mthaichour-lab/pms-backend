import type {
  AuthorizationPolicy,
  AuthorizationResource,
} from '../../../../src/shared-kernel/authorization-contracts.js';
import { evaluateAuthorization } from '../../../../src/modules/identity-access/domain/authorization.js';
import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedUserClaims } from '../auth/authenticated-user.js';
import { PUBLIC_ROUTE } from '../auth/public.decorator.js';
import { AUTHORIZATION_POLICY } from './authorization.decorator.js';
import { authorizationSubjectFromClaims } from './authorization-subject.js';

interface AuthorizationHttpRequest {
  headers: Record<string, string | string[] | undefined>;
  user: AuthenticatedUserClaims;
  params?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
}

@Injectable()
export class AuthorizationGuard implements CanActivate {
  private readonly logger = new Logger(AuthorizationGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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
    if (policy.sensitive) {
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
      throw new ForbiddenException({
        code: 'AUTHORIZATION_DENIED',
        reasons: decision.reasons,
        correlationId,
      });
    }

    return true;
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

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
