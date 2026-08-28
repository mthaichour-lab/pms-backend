import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JWTPayload } from 'jose';
import type { PmsRole } from '../../../../src/shared-kernel/authorization-contracts.js';

export interface AuthenticatedUserClaims extends JWTPayload {
  sub: string;
  groups?: string[];
  roles?: PmsRole[];
  legal_entity_ids?: string[];
  branch_ids?: string[];
  pool_ids?: string[];
  delegation_level?: number;
  maximum_amount?: string;
  delegation_valid_from?: string;
  delegation_valid_until?: string;
  access_review_due_at?: string;
  access_manager_id?: string;
}

export const AuthenticatedUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUserClaims => {
    const request = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUserClaims }>();
    return request.user;
  },
);
