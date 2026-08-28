import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  createRemoteJWKSet,
  errors,
  jwtVerify,
  type JWTVerifyGetKey,
} from 'jose';

import type { AuthenticatedUserClaims } from './authenticated-user.js';
import { PUBLIC_ROUTE } from './public.decorator.js';

interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: AuthenticatedUserClaims;
}

@Injectable()
export class OidcJwtGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  private readonly issuer =
    process.env['OIDC_ISSUER'] ?? 'http://localhost:8080/realms/pms-dev';
  private readonly audience = process.env['OIDC_AUDIENCE'] ?? 'pms-core-api';
  private readonly jwks: JWTVerifyGetKey = createRemoteJWKSet(
    new URL(
      process.env['OIDC_JWKS_URI'] ??
        `${this.issuer}/protocol/openid-connect/certs`,
    ),
  );

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()])) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer\s+(.+)$/i.exec(request.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException('Missing bearer token');

    try {
      const { payload } = await jwtVerify(match[1], this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['RS256'],
        clockTolerance: 5,
        requiredClaims: ['sub', 'iat', 'exp'],
      });
      if (!payload.sub)
        throw new UnauthorizedException('Missing subject claim');
      request.user = payload as AuthenticatedUserClaims;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      if (error instanceof errors.JOSEError) {
        throw new UnauthorizedException('Invalid access token');
      }
      throw error;
    }
  }
}
