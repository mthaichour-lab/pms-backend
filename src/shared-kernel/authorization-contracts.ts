export const PMS_ROLES = [
  'FINANCE_ANALYST',
  'FINANCE_CONTROLLER',
  'RELATIONSHIP_MANAGER',
  'RISK_ANALYST',
  'SHARIA_AUDITOR',
  'SYSTEM_ADMIN',
] as const;

export type PmsRole = (typeof PMS_ROLES)[number];

export interface AuthorizationSubject {
  userId: string;
  roles: readonly PmsRole[];
  legalEntityIds: readonly string[];
  branchIds: readonly string[];
  poolIds: readonly string[];
  delegationLevel: number;
  maximumAmount: string;
  delegationValidFrom?: string;
  delegationValidUntil?: string;
  accessReviewDueAt?: string;
  accessManagerId?: string;
}

export interface AuthorizationResource {
  legalEntityId?: string;
  branchId?: string;
  poolId?: string;
  workflowStatus?: string;
  previousActorId?: string;
}

export interface AuthorizationPolicy {
  operationType: string;
  allowedRoles: readonly PmsRole[];
  allowedWorkflowStatuses?: readonly string[];
  requiredDelegationLevel?: number;
  sensitive?: boolean;
}

export interface AuthorizationRequest {
  subject: AuthorizationSubject;
  resource: AuthorizationResource;
  policy: AuthorizationPolicy;
  amount?: string;
  evaluatedAt?: string;
}

export type AuthorizationDenialReason =
  | 'ROLE_NOT_ALLOWED'
  | 'LEGAL_ENTITY_OUT_OF_SCOPE'
  | 'BRANCH_OUT_OF_SCOPE'
  | 'POOL_OUT_OF_SCOPE'
  | 'WORKFLOW_STATUS_NOT_ALLOWED'
  | 'INSUFFICIENT_DELEGATION'
  | 'DELEGATION_NOT_ACTIVE'
  | 'DELEGATION_EXPIRED'
  | 'INVALID_DELEGATION_PERIOD'
  | 'AMOUNT_EXCEEDS_LIMIT'
  | 'PREVIOUS_ACTOR_CONFLICT'
  | 'INVALID_AMOUNT';

export interface AuthorizationDecision {
  allowed: boolean;
  reasons: readonly AuthorizationDenialReason[];
}

export type AccessGrantKind = 'ENTITLEMENT' | 'DELEGATION';

export interface AccessGrant {
  id: string;
  subjectId: string;
  managerId: string;
  kind: AccessGrantKind;
  grantedAt: string;
  lastReviewedAt?: string;
  reviewIntervalDays: number;
  validFrom?: string;
  validUntil?: string;
}

export interface AccessReviewNotification {
  type: 'ACCESS_REVIEW_DUE';
  grantId: string;
  subjectId: string;
  managerId: string;
  dueAt: string;
}

export interface AccessGovernanceEvaluation {
  effectiveGrantIds: readonly string[];
  expiredDelegationIds: readonly string[];
  reviewNotifications: readonly AccessReviewNotification[];
}

