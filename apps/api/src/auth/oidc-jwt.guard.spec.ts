import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import { OidcJwtGuard } from './oidc-jwt.guard.js';

function contextWithAuthorization(authorization?: string): ExecutionContext {
  return {
    getHandler: () => contextWithAuthorization,
    getClass: () => OidcJwtGuard,
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  } as unknown as ExecutionContext;
}

describe('OidcJwtGuard', () => {
  it('rejects requests without a bearer token before controller execution', async () => {
    const guard = new OidcJwtGuard(new Reflector());
    await expect(
      guard.canActivate(contextWithAuthorization()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
