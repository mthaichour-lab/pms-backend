import type {
  AccessGrant,
  AuthorizationRequest,
} from '../../../src/shared-kernel/authorization-contracts.js';
import { describe, expect, it } from 'vitest';

import {
  evaluateAccessGovernance,
  evaluateAuthorization,
} from '../../../src/modules/identity-access/domain/authorization.js';

const baseRequest: AuthorizationRequest = {
  subject: {
    userId: 'user-1',
    roles: ['FINANCE_CONTROLLER'],
    legalEntityIds: ['entity-1'],
    branchIds: ['branch-1'],
    poolIds: ['pool-1'],
    delegationLevel: 2,
    maximumAmount: '100000.00',
  },
  resource: {
    legalEntityId: 'entity-1',
    branchId: 'branch-1',
    poolId: 'pool-1',
    workflowStatus: 'PENDING_APPROVAL',
  },
  policy: {
    operationType: 'APPROVE_POOL_OPERATION',
    allowedRoles: ['FINANCE_CONTROLLER', 'SYSTEM_ADMIN'],
    allowedWorkflowStatuses: ['PENDING_APPROVAL'],
    requiredDelegationLevel: 2,
    sensitive: true,
  },
  amount: '50000.00',
  evaluatedAt: '2026-08-27T12:00:00.000Z',
};

describe('evaluateAuthorization', () => {
  it('allows an operation only when every applicable attribute matches', () => {
    expect(evaluateAuthorization(baseRequest)).toEqual({
      allowed: true,
      reasons: [],
    });
  });

  it('denies a pool outside scope even for a system administrator', () => {
    const decision = evaluateAuthorization({
      ...baseRequest,
      subject: {
        ...baseRequest.subject,
        roles: ['SYSTEM_ADMIN'],
        poolIds: ['another-pool'],
      },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('POOL_OUT_OF_SCOPE');
  });

  it('evaluates amount, operation delegation and workflow together', () => {
    const decision = evaluateAuthorization({
      ...baseRequest,
      subject: {
        ...baseRequest.subject,
        delegationLevel: 1,
        maximumAmount: '10000.00',
      },
      resource: { ...baseRequest.resource, workflowStatus: 'DRAFT' },
    });

    expect(decision.reasons).toEqual([
      'WORKFLOW_STATUS_NOT_ALLOWED',
      'INSUFFICIENT_DELEGATION',
      'AMOUNT_EXCEEDS_LIMIT',
    ]);
  });

  it('enforces separation from the previous actor', () => {
    const decision = evaluateAuthorization({
      ...baseRequest,
      resource: { ...baseRequest.resource, previousActorId: 'user-1' },
    });

    expect(decision.reasons).toContain('PREVIOUS_ACTOR_CONFLICT');
  });

  it('automatically rejects an expired delegation', () => {
    const decision = evaluateAuthorization({
      ...baseRequest,
      subject: {
        ...baseRequest.subject,
        delegationValidUntil: '2026-08-26T23:59:59.000Z',
      },
    });

    expect(decision.reasons).toContain('DELEGATION_EXPIRED');
  });

  it('denies a malformed delegation period safely', () => {
    const decision = evaluateAuthorization({
      ...baseRequest,
      subject: { ...baseRequest.subject, delegationValidUntil: 'not-a-date' },
    });

    expect(decision.reasons).toContain('INVALID_DELEGATION_PERIOD');
  });

  it('compares financial amounts without converting them to floating point', () => {
    const decision = evaluateAuthorization({
      ...baseRequest,
      subject: {
        ...baseRequest.subject,
        maximumAmount: '999999999999999999.99',
      },
      amount: '1000000000000000000.00',
    });

    expect(decision.reasons).toContain('AMOUNT_EXCEEDS_LIMIT');
  });
});

describe('evaluateAccessGovernance', () => {
  const grants: AccessGrant[] = [
    {
      id: 'entitlement-1',
      subjectId: 'user-1',
      managerId: 'manager-1',
      kind: 'ENTITLEMENT',
      grantedAt: '2026-01-01T00:00:00.000Z',
      reviewIntervalDays: 90,
    },
    {
      id: 'delegation-1',
      subjectId: 'user-1',
      managerId: 'manager-1',
      kind: 'DELEGATION',
      grantedAt: '2026-08-01T00:00:00.000Z',
      reviewIntervalDays: 90,
      validUntil: '2026-08-20T00:00:00.000Z',
    },
  ];

  it('signals overdue reviews to the responsible manager', () => {
    const result = evaluateAccessGovernance(grants, '2026-08-27T00:00:00.000Z');

    expect(result.reviewNotifications).toContainEqual({
      type: 'ACCESS_REVIEW_DUE',
      grantId: 'entitlement-1',
      subjectId: 'user-1',
      managerId: 'manager-1',
      dueAt: '2026-04-01T00:00:00.000Z',
    });
  });

  it('removes an expired delegation from effective grants automatically', () => {
    const result = evaluateAccessGovernance(grants, '2026-08-27T00:00:00.000Z');

    expect(result.expiredDelegationIds).toEqual(['delegation-1']);
    expect(result.effectiveGrantIds).not.toContain('delegation-1');
  });
});
