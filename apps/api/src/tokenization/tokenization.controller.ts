import { BadGatewayException, BadRequestException, Body, Controller, Headers, Inject, NotFoundException, Post } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ManageTokenization } from '../../../../src/modules/tokenization/application/token-vault.js';
import type { PersonalDataClass } from '../../../../src/modules/tokenization/domain/tokenized-identity.js';
import { AuthenticatedUser, type AuthenticatedUserClaims } from '../auth/authenticated-user.js';
import { RequireAuthorization } from '../authorization/authorization.decorator.js';
import { MANAGE_TOKENIZATION } from './tokenization.tokens.js';

@Controller('tokenization')
export class TokenizationController {
  constructor(@Inject(MANAGE_TOKENIZATION) private readonly tokenization: ManageTokenization) {}

  @Post('tokenize')
  @RequireAuthorization({ operationType: 'TOKENIZE_PERSONAL_DATA', allowedRoles: ['FINANCE_ANALYST', 'SYSTEM_ADMIN'], requiredDelegationLevel: 1, sensitive: true })
  tokenize(@Body() body: { value?: string; dataClass?: PersonalDataClass; purpose?: string }, @Headers('x-correlation-id') correlationId: string | undefined, @Headers('idempotency-key') idempotencyKey: string | undefined, @AuthenticatedUser() user: AuthenticatedUserClaims) {
    return this.execute(() => this.tokenization.tokenize(body.value ?? '', body.dataClass ?? 'CUSTOMER_ID', context(user.sub, body.purpose, correlationId, idempotencyKey)));
  }

  @Post('tokenize-batch')
  @RequireAuthorization({ operationType: 'TOKENIZE_PERSONAL_DATA_BATCH', allowedRoles: ['SYSTEM_ADMIN'], requiredDelegationLevel: 2, sensitive: true })
  tokenizeBatch(@Body() body: { values?: string[]; dataClass?: PersonalDataClass; purpose?: string }, @Headers('x-correlation-id') correlationId: string | undefined, @Headers('idempotency-key') idempotencyKey: string | undefined, @AuthenticatedUser() user: AuthenticatedUserClaims) {
    return this.execute(() => this.tokenization.tokenizeBatch(body.values ?? [], body.dataClass ?? 'CUSTOMER_ID', context(user.sub, body.purpose, correlationId, idempotencyKey)));
  }

  @Post('detokenize')
  @RequireAuthorization({ operationType: 'DETOKENIZE_PERSONAL_DATA', allowedRoles: ['SYSTEM_ADMIN'], requiredDelegationLevel: 3, sensitive: true })
  detokenize(@Body() body: { token?: string; purpose?: string }, @Headers('x-correlation-id') correlationId: string | undefined, @Headers('idempotency-key') idempotencyKey: string | undefined, @AuthenticatedUser() user: AuthenticatedUserClaims) {
    return this.execute(async () => ({ value: await this.tokenization.detokenize(body.token ?? '', context(user.sub, body.purpose, correlationId, idempotencyKey)) }));
  }

  @Post('search')
  @RequireAuthorization({ operationType: 'SEARCH_TOKENIZED_DATA', allowedRoles: ['SYSTEM_ADMIN'], requiredDelegationLevel: 2, sensitive: true })
  search(@Body() body: { searchDigestSha256?: string; dataClass?: PersonalDataClass; purpose?: string }, @Headers('x-correlation-id') correlationId: string | undefined, @Headers('idempotency-key') idempotencyKey: string | undefined, @AuthenticatedUser() user: AuthenticatedUserClaims) {
    return this.execute(async () => {
      const result = await this.tokenization.search(body.searchDigestSha256 ?? '', body.dataClass ?? 'CUSTOMER_ID', context(user.sub, body.purpose, correlationId, idempotencyKey));
      if (!result) throw new NotFoundException('Tokenized value not found');
      return result;
    });
  }

  @Post('rotate')
  @RequireAuthorization({ operationType: 'ROTATE_PERSONAL_DATA_TOKEN', allowedRoles: ['SYSTEM_ADMIN'], requiredDelegationLevel: 3, sensitive: true })
  rotate(@Body() body: { token?: string; purpose?: string }, @Headers('x-correlation-id') correlationId: string | undefined, @Headers('idempotency-key') idempotencyKey: string | undefined, @AuthenticatedUser() user: AuthenticatedUserClaims) {
    return this.execute(() => this.tokenization.rotate(body.token ?? '', context(user.sub, body.purpose, correlationId, idempotencyKey)));
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof TypeError || error instanceof RangeError) throw new BadRequestException(error.message);
      if (error instanceof Error) throw new BadGatewayException('Token Vault operation failed');
      throw error;
    }
  }
}

function context(actorId: string, purpose: string | undefined, correlationId: string | undefined, idempotencyKey: string | undefined) {
  return { actorId, purpose: purpose ?? '', idempotencyKey: idempotencyKey ?? '', correlationId: correlationId && /^[0-9a-f-]{36}$/i.test(correlationId) ? correlationId : randomUUID() };
}
