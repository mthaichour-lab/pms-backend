import type {
  AccessGovernanceEvaluation,
  AccessGrant,
  AuthorizationDecision,
  AuthorizationDenialReason,
  AuthorizationRequest,
} from '../../../shared-kernel/authorization-contracts.js';

export function evaluateAuthorization(
  request: AuthorizationRequest,
): AuthorizationDecision {
  const { subject, resource, policy, amount } = request;
  const reasons: AuthorizationDenialReason[] = [];
  const evaluatedAt = timestamp(
    request.evaluatedAt ?? new Date().toISOString(),
  );

  if (!policy.allowedRoles.some((role) => subject.roles.includes(role))) {
    reasons.push('ROLE_NOT_ALLOWED');
  }
  if (
    resource.legalEntityId &&
    !subject.legalEntityIds.includes(resource.legalEntityId)
  ) {
    reasons.push('LEGAL_ENTITY_OUT_OF_SCOPE');
  }
  if (resource.branchId && !subject.branchIds.includes(resource.branchId)) {
    reasons.push('BRANCH_OUT_OF_SCOPE');
  }
  if (resource.poolId && !subject.poolIds.includes(resource.poolId)) {
    reasons.push('POOL_OUT_OF_SCOPE');
  }
  if (
    resource.workflowStatus &&
    policy.allowedWorkflowStatuses &&
    !policy.allowedWorkflowStatuses.includes(resource.workflowStatus)
  ) {
    reasons.push('WORKFLOW_STATUS_NOT_ALLOWED');
  }
  if (policy.requiredDelegationLevel !== undefined) {
    const validFrom = safeOptionalTimestamp(subject.delegationValidFrom);
    const validUntil = safeOptionalTimestamp(subject.delegationValidUntil);
    if (
      validFrom === null ||
      validUntil === null ||
      (validFrom !== undefined &&
        validUntil !== undefined &&
        validFrom > validUntil)
    ) {
      reasons.push('INVALID_DELEGATION_PERIOD');
    } else if (validFrom !== undefined && evaluatedAt < validFrom) {
      reasons.push('DELEGATION_NOT_ACTIVE');
    } else if (validUntil !== undefined && evaluatedAt > validUntil) {
      reasons.push('DELEGATION_EXPIRED');
    } else if (subject.delegationLevel < policy.requiredDelegationLevel) {
      reasons.push('INSUFFICIENT_DELEGATION');
    }
  }
  if (
    amount !== undefined &&
    (!isUnsignedDecimal(amount) || !isUnsignedDecimal(subject.maximumAmount))
  ) {
    reasons.push('INVALID_AMOUNT');
  } else if (
    amount !== undefined &&
    compareUnsignedDecimals(amount, subject.maximumAmount) > 0
  ) {
    reasons.push('AMOUNT_EXCEEDS_LIMIT');
  }
  if (resource.previousActorId && resource.previousActorId === subject.userId) {
    reasons.push('PREVIOUS_ACTOR_CONFLICT');
  }

  return { allowed: reasons.length === 0, reasons };
}

export function evaluateAccessGovernance(
  grants: readonly AccessGrant[],
  evaluatedAt: string,
): AccessGovernanceEvaluation {
  const now = timestamp(evaluatedAt);
  const effectiveGrantIds: string[] = [];
  const expiredDelegationIds: string[] = [];
  const reviewNotifications: AccessGovernanceEvaluation['reviewNotifications'][number][] =
    [];

  for (const grant of grants) {
    const validFrom = optionalTimestamp(grant.validFrom);
    const validUntil = optionalTimestamp(grant.validUntil);
    const expired =
      grant.kind === 'DELEGATION' &&
      validUntil !== undefined &&
      now > validUntil;
    const notStarted = validFrom !== undefined && now < validFrom;

    if (expired) expiredDelegationIds.push(grant.id);
    if (!expired && !notStarted) effectiveGrantIds.push(grant.id);

    const reviewAnchor = timestamp(grant.lastReviewedAt ?? grant.grantedAt);
    const dueAt = reviewAnchor + grant.reviewIntervalDays * 86_400_000;
    if (now >= dueAt) {
      reviewNotifications.push({
        type: 'ACCESS_REVIEW_DUE',
        grantId: grant.id,
        subjectId: grant.subjectId,
        managerId: grant.managerId,
        dueAt: new Date(dueAt).toISOString(),
      });
    }
  }

  return { effectiveGrantIds, expiredDelegationIds, reviewNotifications };
}

function timestamp(value: string): number {
  const result = Date.parse(value);
  if (!Number.isFinite(result))
    throw new TypeError(`Invalid ISO date: ${value}`);
  return result;
}

function optionalTimestamp(value: string | undefined): number | undefined {
  return value === undefined ? undefined : timestamp(value);
}

function safeOptionalTimestamp(
  value: string | undefined,
): number | undefined | null {
  if (value === undefined) return undefined;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

function isUnsignedDecimal(value: string): boolean {
  return /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value);
}

function compareUnsignedDecimals(left: string, right: string): number {
  const [leftInteger, leftFraction = ''] = left.split('.');
  const [rightInteger, rightFraction = ''] = right.split('.');
  if (leftInteger.length !== rightInteger.length) {
    return leftInteger.length > rightInteger.length ? 1 : -1;
  }
  if (leftInteger !== rightInteger) return leftInteger > rightInteger ? 1 : -1;

  const fractionLength = Math.max(leftFraction.length, rightFraction.length);
  const normalizedLeft = leftFraction.padEnd(fractionLength, '0');
  const normalizedRight = rightFraction.padEnd(fractionLength, '0');
  if (normalizedLeft === normalizedRight) return 0;
  return normalizedLeft > normalizedRight ? 1 : -1;
}
