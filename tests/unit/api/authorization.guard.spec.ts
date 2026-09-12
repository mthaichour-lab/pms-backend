import { BadRequestException, ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { AuthorizationGuard } from '../../../apps/api/src/authorization/authorization.guard.js';
import { AUTHORIZATION_POLICY } from '../../../apps/api/src/authorization/authorization.decorator.js';
import { PUBLIC_ROUTE } from '../../../apps/api/src/auth/public.decorator.js';

const policy = {
  operationType: 'READ_AUDIT_TRAIL',
  allowedRoles: ['FINANCE_CONTROLLER'] as const,
  requiredDelegationLevel: 2,
  sensitive: true,
};

function context(method: string, user: Record<string, unknown> = { sub: 'auditor-1', roles: ['FINANCE_CONTROLLER'], delegation_level: 2 }): ExecutionContext {
  const request = {
    method,
    headers: { 'x-correlation-id': '65aeb69d-73a7-4f04-9578-5fa8326f654f' },
    user,
    ip: '127.0.0.1',
  };
  return {
    getHandler: () => context,
    getClass: () => AuthorizationGuard,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AuthorizationGuard idempotency semantics', () => {
  const reflector = {
    getAllAndOverride: vi.fn((metadataKey: string) => metadataKey === PUBLIC_ROUTE ? false : metadataKey === AUTHORIZATION_POLICY ? policy : undefined),
  } as unknown as Reflector;

  const audit = () => ({ append: vi.fn(async (draft) => ({ ...draft, eventHash: 'a'.repeat(64), signingKeyId: 'kms', signatureBase64: 'c2ln' })) });

  it('allows an authorized sensitive read without an idempotency key and without audit write', async () => {
    const writer = audit();
    await expect(new AuthorizationGuard(reflector, writer).canActivate(context('GET'))).resolves.toBe(true);
    expect(writer.append).not.toHaveBeenCalled();
  });

  it('still requires idempotency for a sensitive state-changing request without audit write', async () => {
    const writer = audit();
    await expect(new AuthorizationGuard(reflector, writer).canActivate(context('POST'))).rejects.toBeInstanceOf(BadRequestException);
    expect(writer.append).not.toHaveBeenCalled();
  });

  it('durably records a denied decision before returning forbidden', async () => {
    const writer = audit();
    const guard = new AuthorizationGuard(reflector, writer);
    await expect(guard.canActivate(context('GET', { sub: 'denied-user', sid: 'session-1', roles: [], delegation_level: 0 }))).rejects.toBeInstanceOf(ForbiddenException);
    expect(writer.append).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'denied-user', sessionId: 'session-1', correlationId: '65aeb69d-73a7-4f04-9578-5fa8326f654f',
      action: 'READ_AUDIT_TRAIL', resourceType: 'AuthorizationDecision', outcome: 'DENIED', sourceApplication: 'pms-api', sourceAddress: '127.0.0.1',
      authorizedChanges: { decision: { allowed: false, reasons: expect.arrayContaining(['ROLE_NOT_ALLOWED', 'INSUFFICIENT_DELEGATION']) }, resource: expect.any(Object) },
    }));
  });

  it('preserves forbidden when durable audit is unavailable', async () => {
    const writer = { append: vi.fn(async () => { throw new Error('KMS unavailable'); }) };
    await expect(new AuthorizationGuard(reflector, writer).canActivate(context('GET', { sub: 'denied-user', roles: [], delegation_level: 0 }))).rejects.toBeInstanceOf(ForbiddenException);
    expect(writer.append).toHaveBeenCalledOnce();
  });

  it('preserves public routes without authorization or audit', async () => {
    const publicReflector = { getAllAndOverride: vi.fn((key: string) => key === PUBLIC_ROUTE ? true : undefined) } as unknown as Reflector;
    const writer = audit();
    await expect(new AuthorizationGuard(publicReflector, writer).canActivate(context('GET', {}))).resolves.toBe(true);
    expect(writer.append).not.toHaveBeenCalled();
  });
});
