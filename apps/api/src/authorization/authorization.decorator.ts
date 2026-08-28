import type { AuthorizationPolicy } from '../../../../src/shared-kernel/authorization-contracts.js';
import { SetMetadata } from '@nestjs/common';

export const AUTHORIZATION_POLICY = 'pms:authorization-policy';

export const RequireAuthorization = (policy: AuthorizationPolicy) =>
  SetMetadata(AUTHORIZATION_POLICY, policy);
