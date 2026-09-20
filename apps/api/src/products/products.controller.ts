import { BadRequestException, Body, ConflictException, Controller, Get, Headers, Inject, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ManageInvestmentProduct } from '../../../../src/modules/products/application/manage-investment-product.js';
import { ManageProductTerms } from '../../../../src/modules/products/application/manage-product-terms.js';
import { ManageProductReferences } from '../../../../src/modules/products/application/manage-product-references.js';
import type { ComplianceSource, ProductReferenceKind } from '../../../../src/modules/products/domain/compliance-reference.js';
import { AuthenticatedUser, type AuthenticatedUserClaims } from '../auth/authenticated-user.js';
import { RequireAuthorization } from '../authorization/authorization.decorator.js';
import { MANAGE_INVESTMENT_PRODUCT, MANAGE_PRODUCT_REFERENCES, MANAGE_PRODUCT_TERMS } from './products.tokens.js';

@Controller('products')
export class ProductsController {
  constructor(
    @Inject(MANAGE_INVESTMENT_PRODUCT) private readonly products: ManageInvestmentProduct,
    @Inject(MANAGE_PRODUCT_TERMS) private readonly terms: ManageProductTerms,
    @Inject(MANAGE_PRODUCT_REFERENCES) private readonly references: ManageProductReferences,
  ) {}

  @Get()
  @RequireAuthorization({ operationType: 'LIST_INVESTMENT_PRODUCTS', allowedRoles: ['FINANCE_ANALYST', 'FINANCE_CONTROLLER', 'RELATIONSHIP_MANAGER', 'RISK_ANALYST', 'SHARIA_AUDITOR', 'SYSTEM_ADMIN'], requiredDelegationLevel: 1 })
  list(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.execute(() => this.products.list(parsePagination(limit, 'limit'), parsePagination(offset, 'offset')));
  }

  @Post('compliance-references')
  @RequireAuthorization({ operationType: 'CREATE_COMPLIANCE_REFERENCE', allowedRoles: ['SHARIA_AUDITOR', 'SYSTEM_ADMIN'], requiredDelegationLevel: 2, sensitive: true })
  createReference(@Body() body: { source?: ComplianceSource; referenceCode?: string; version?: string; title?: string; effectiveFrom?: string; effectiveTo?: string }, @AuthenticatedUser() user: AuthenticatedUserClaims) {
    return this.execute(() => this.references.create({ source: body.source as ComplianceSource, referenceCode: body.referenceCode ?? '', version: body.version ?? '', title: body.title ?? '', effectiveFrom: body.effectiveFrom ?? '', effectiveTo: body.effectiveTo, actorId: user.sub }));
  }

  @Get(':productId/references')
  listReferences(@Param('productId') productId: string) { return this.execute(() => this.references.list(productId)); }

  @Post(':productId/references')
  @RequireAuthorization({ operationType: 'ASSOCIATE_PRODUCT_REFERENCE', allowedRoles: ['SHARIA_AUDITOR', 'FINANCE_CONTROLLER', 'SYSTEM_ADMIN'], requiredDelegationLevel: 2, sensitive: true })
  associateReference(@Param('productId') productId: string, @Body() body: { referenceId?: string; kind?: ProductReferenceKind }, @AuthenticatedUser() user: AuthenticatedUserClaims) {
    return this.execute(() => this.references.associate(productId, body.referenceId ?? '', body.kind as ProductReferenceKind, user.sub));
  }

  @Post(':productId/compliance-arbitrations')
  @RequireAuthorization({ operationType: 'ARBITRATE_PRODUCT_COMPLIANCE', allowedRoles: ['SHARIA_AUDITOR', 'SYSTEM_ADMIN'], requiredDelegationLevel: 3, sensitive: true })
  arbitrate(@Param('productId') productId: string, @Body() body: { selectedReferenceId?: string; rejectedReferenceId?: string; rationale?: string }, @AuthenticatedUser() user: AuthenticatedUserClaims) {
    return this.execute(() => this.references.arbitrate({ productId, selectedReferenceId: body.selectedReferenceId ?? '', rejectedReferenceId: body.rejectedReferenceId ?? '', rationale: body.rationale ?? '', actorId: user.sub }));
  }

  @Post(':productId/terms/simulate')
  @RequireAuthorization({ operationType: 'SIMULATE_PRODUCT_TERMS', allowedRoles: ['FINANCE_ANALYST', 'FINANCE_CONTROLLER', 'SYSTEM_ADMIN'], requiredDelegationLevel: 1 })
  simulateTerms(@Param('productId') productId: string, @Body() body: { effectiveFrom?: string; effectiveTo?: string; investorNisba?: string; bankNisba?: string; indicativeTargetRate?: string }) {
    try { return this.terms.simulate({ productId, effectiveFrom: body.effectiveFrom ?? '', effectiveTo: body.effectiveTo, investorNisba: body.investorNisba ?? '', bankNisba: body.bankNisba ?? '', indicativeTargetRate: body.indicativeTargetRate }); }
    catch (error) { if (error instanceof Error) throw new BadRequestException(error.message); throw error; }
  }

  @Post(':productId/terms')
  @RequireAuthorization({ operationType: 'CREATE_PRODUCT_TERMS', allowedRoles: ['FINANCE_ANALYST', 'SYSTEM_ADMIN'], requiredDelegationLevel: 1 })
  createTerms(@Param('productId') productId: string, @Body() body: { effectiveFrom?: string; effectiveTo?: string; investorNisba?: string; bankNisba?: string; indicativeTargetRate?: string }, @Headers('idempotency-key') idempotencyKey: string | undefined, @AuthenticatedUser() user: AuthenticatedUserClaims) {
    return this.execute(() => this.terms.createDraft({ productId, effectiveFrom: body.effectiveFrom ?? '', effectiveTo: body.effectiveTo, investorNisba: body.investorNisba ?? '', bankNisba: body.bankNisba ?? '', indicativeTargetRate: body.indicativeTargetRate }, user.sub, idempotencyKey ?? ''));
  }

  @Post(':productId/terms/:termsVersionId/publish')
  @RequireAuthorization({ operationType: 'PUBLISH_PRODUCT_TERMS', allowedRoles: ['FINANCE_CONTROLLER', 'SYSTEM_ADMIN'], requiredDelegationLevel: 3, sensitive: true })
  publishTerms(@Param('productId') productId: string, @Param('termsVersionId') termsVersionId: string, @Body() body: { businessDate?: string; simulationChecksumSha256?: string; retroactiveApprovalId?: string; justification?: string }, @Headers('idempotency-key') idempotencyKey: string | undefined, @AuthenticatedUser() user: AuthenticatedUserClaims) {
    return this.execute(() => this.terms.publish(productId, termsVersionId, { businessDate: body.businessDate ?? '', simulationChecksumSha256: body.simulationChecksumSha256 ?? '', retroactiveApprovalId: body.retroactiveApprovalId, actorId: user.sub, justification: body.justification ?? '', idempotencyKey: idempotencyKey ?? '' }));
  }

  @Post()
  @RequireAuthorization({ operationType: 'CREATE_PRODUCT', allowedRoles: ['FINANCE_ANALYST', 'SYSTEM_ADMIN'], requiredDelegationLevel: 1 })
  create(@Body() body: { code?: string; name?: string; investorNisba?: string; bankNisba?: string; shariaReference?: string }, @Headers('idempotency-key') idempotencyKey: string | undefined, @AuthenticatedUser() user: AuthenticatedUserClaims) {
    return this.execute(() => this.products.create({ code: body.code ?? '', name: body.name ?? '', investorNisba: body.investorNisba ?? '', bankNisba: body.bankNisba ?? '', shariaReference: body.shariaReference, actorId: user.sub, idempotencyKey: idempotencyKey ?? '' }));
  }

  @Get(':productId')
  get(@Param('productId') productId: string) { return this.execute(() => this.products.get(productId)); }

  @Post(':productId/:action')
  @RequireAuthorization({ operationType: 'TRANSITION_PRODUCT', allowedRoles: ['FINANCE_CONTROLLER', 'SYSTEM_ADMIN'], requiredDelegationLevel: 2, sensitive: true })
  transition(@Param('productId') productId: string, @Param('action') action: string, @Body() body: { justification?: string }, @Headers('idempotency-key') idempotencyKey: string | undefined, @AuthenticatedUser() user: AuthenticatedUserClaims) {
    const normalized = action.toUpperCase() as 'VALIDATE' | 'PUBLISH' | 'SUSPEND' | 'RESUME' | 'CLOSE';
    if (!['VALIDATE', 'PUBLISH', 'SUSPEND', 'RESUME', 'CLOSE'].includes(normalized)) throw new NotFoundException('Unknown product transition');
    return this.execute(() => this.products.transition(productId, normalized, user.sub, body.justification ?? '', idempotencyKey ?? ''));
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) {
      if (error instanceof TypeError || error instanceof RangeError) throw new BadRequestException(error.message);
      if (error instanceof Error && (error.message.startsWith('Investment product not found') || error.message.startsWith('Product terms not found'))) throw new NotFoundException(error.message);
      if (error instanceof Error) throw new ConflictException(error.message);
      throw error;
    }
  }
}

function parsePagination(value: string | undefined, field: 'limit' | 'offset'): number | undefined {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) throw new BadRequestException(`${field} must be a non-negative integer`);
  return Number(value);
}
