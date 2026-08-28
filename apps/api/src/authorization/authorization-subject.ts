import type {
  AuthorizationSubject,
  PmsRole,
} from '../../../../src/shared-kernel/authorization-contracts.js';
import { PMS_ROLES } from '../../../../src/shared-kernel/authorization-contracts.js';

import type { AuthenticatedUserClaims } from '../auth/authenticated-user.js';

const groupRoleMapping: Readonly<Record<string, PmsRole>> = {
  'pms-finance-analysts': 'FINANCE_ANALYST',
  'pms-finance-controllers': 'FINANCE_CONTROLLER',
  'pms-relationship-managers': 'RELATIONSHIP_MANAGER',
  'pms-risk-analysts': 'RISK_ANALYST',
  'pms-sharia-auditors': 'SHARIA_AUDITOR',
  'pms-system-admins': 'SYSTEM_ADMIN',
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function rolesFromClaims(claims: AuthenticatedUserClaims): PmsRole[] {
  const directRoles = stringArray(claims.roles).filter(
    (role): role is PmsRole => (PMS_ROLES as readonly string[]).includes(role),
  );
  const groupRoles = stringArray(claims.groups).flatMap((group) => {
    const role = groupRoleMapping[group.replace(/^\//, '').toLowerCase()];
    return role ? [role] : [];
  });
  return [...new Set([...directRoles, ...groupRoles])];
}

export function authorizationSubjectFromClaims(
  claims: AuthenticatedUserClaims,
): AuthorizationSubject {
  return {
    userId: claims.sub,
    roles: rolesFromClaims(claims),
    legalEntityIds: stringArray(claims.legal_entity_ids),
    branchIds: stringArray(claims.branch_ids),
    poolIds: stringArray(claims.pool_ids),
    delegationLevel:
      typeof claims.delegation_level === 'number' ? claims.delegation_level : 0,
    maximumAmount:
      typeof claims.maximum_amount === 'string' ? claims.maximum_amount : '0',
    delegationValidFrom: optionalString(claims.delegation_valid_from),
    delegationValidUntil: optionalString(claims.delegation_valid_until),
    accessReviewDueAt: optionalString(claims.access_review_due_at),
    accessManagerId: optionalString(claims.access_manager_id),
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
