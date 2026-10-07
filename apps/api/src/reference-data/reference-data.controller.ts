import { BadRequestException, Body, ConflictException, Controller, Get, HttpException, Inject, NotFoundException, Param, Post, Query } from '@nestjs/common';

import { GetEffectiveCurrency, ManageCurrencyReference, type CurrencyDefinition } from '../../../../src/modules/reference-data/application/currency-reference.js';
import { AuthenticatedUser, type AuthenticatedUserClaims } from '../auth/authenticated-user.js';
import { RequireAuthorization } from '../authorization/authorization.decorator.js';
import { GET_EFFECTIVE_CURRENCY, MANAGE_CURRENCY_REFERENCE } from './reference-data.tokens.js';

@Controller('reference-data/currencies')
export class ReferenceDataController {
  constructor(
    @Inject(GET_EFFECTIVE_CURRENCY)
    private readonly getEffectiveCurrency: GetEffectiveCurrency,
    @Inject(MANAGE_CURRENCY_REFERENCE)
    private readonly currencies: ManageCurrencyReference,
  ) {}

  @Get()
  @RequireAuthorization({ operationType: 'LIST_CURRENCY_REFERENCES', allowedRoles: ['FINANCE_ANALYST', 'FINANCE_CONTROLLER', 'RELATIONSHIP_MANAGER', 'RISK_ANALYST', 'SHARIA_AUDITOR', 'SYSTEM_ADMIN'], requiredDelegationLevel: 1 })
  async listCurrencies(
    @Query('businessDate') businessDate: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('offset') offset: string | undefined,
  ) {
    if (!businessDate) throw new BadRequestException('businessDate is required');
    return this.execute(() => this.currencies.list(businessDate, parsePagination(limit, 'limit') ?? 50, parsePagination(offset, 'offset') ?? 0));
  }

  @Post()
  @RequireAuthorization({ operationType: 'CREATE_CURRENCY_REFERENCE', allowedRoles: ['SYSTEM_ADMIN'], requiredDelegationLevel: 3, sensitive: true })
  async createCurrency(@Body() body: Partial<CurrencyDefinition>, @AuthenticatedUser() user: AuthenticatedUserClaims) {
    return this.execute(() => this.currencies.create({
      code: body.code ?? '', name: body.name ?? '', fractionDigits: body.fractionDigits ?? Number.NaN,
      validFrom: body.validFrom ?? '', ...(body.validUntil ? { validUntil: body.validUntil } : {}),
    }, user.sub));
  }

  @Get(':code')
  async getCurrency(
    @Param('code') code: string,
    @Query('businessDate') businessDate: string | undefined,
  ) {
    if (!businessDate) throw new BadRequestException('businessDate is required');
    return this.execute(() => this.getEffectiveCurrency.execute(code, businessDate));
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof TypeError || error instanceof RangeError) throw new BadRequestException(error.message);
      if (error instanceof Error && error.message.startsWith('No effective currency')) throw new NotFoundException(error.message);
      if (error instanceof Error) throw new ConflictException(error.message);
      throw error;
    }
  }
}

function parsePagination(value: string | undefined, field: 'limit' | 'offset'): number | undefined {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) throw new BadRequestException(`${field} must be a non-negative integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || (field === 'limit' && (parsed < 1 || parsed > 100))) {
    throw new BadRequestException(`${field} must be ${field === 'limit' ? 'between 1 and 100' : 'a non-negative integer'}`);
  }
  return parsed;
}
