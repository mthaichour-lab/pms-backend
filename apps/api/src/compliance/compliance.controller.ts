import { BadRequestException, Body, ConflictException, Controller, Inject, Param, Post } from '@nestjs/common';
import { ManageShariaReview } from '../../../../src/modules/compliance/application/manage-sharia-review.js';
import { AuthenticatedUser, type AuthenticatedUserClaims } from '../auth/authenticated-user.js';
import { RequireAuthorization } from '../authorization/authorization.decorator.js';
import { MANAGE_SHARIA_REVIEW } from './compliance.tokens.js';

@Controller('compliance/sharia-reviews')
export class ComplianceController {
  constructor(@Inject(MANAGE_SHARIA_REVIEW) private readonly reviews: ManageShariaReview) {}

  @Post()
  @RequireAuthorization({ operationType: 'SUBMIT_SHARIA_REVIEW', allowedRoles: ['FINANCE_ANALYST', 'SYSTEM_ADMIN'], requiredDelegationLevel: 1 })
  submit(@Body() body: { resourceType?: string; resourceId?: string }, @AuthenticatedUser() user: AuthenticatedUserClaims) {
    return this.execute(() => this.reviews.submit(body.resourceType ?? '', body.resourceId ?? '', user.sub));
  }

  @Post(':reviewId/review')
  @RequireAuthorization({ operationType: 'REVIEW_SHARIA_CASE', allowedRoles: ['SHARIA_AUDITOR', 'SYSTEM_ADMIN'], requiredDelegationLevel: 2, sensitive: true })
  review(@Param('reviewId') reviewId: string, @Body() body: { opinion?: string }, @AuthenticatedUser() user: AuthenticatedUserClaims) {
    return this.execute(() => this.reviews.review(reviewId, user.sub, body.opinion ?? ''));
  }

  @Post(':reviewId/decide')
  @RequireAuthorization({ operationType: 'DECIDE_SHARIA_CASE', allowedRoles: ['SHARIA_AUDITOR', 'SYSTEM_ADMIN'], requiredDelegationLevel: 3, sensitive: true })
  decide(
    @Param('reviewId') reviewId: string,
    @Body() body: { decision?: 'APPROVED' | 'REJECTED'; justification?: string; evidenceDocumentId?: string },
    @AuthenticatedUser() user: AuthenticatedUserClaims,
  ) {
    return this.execute(() => this.reviews.decide(
      reviewId, user.sub, body.decision ?? '' as 'APPROVED', body.justification ?? '', body.evidenceDocumentId ?? '',
    ));
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) {
      if (error instanceof TypeError) throw new BadRequestException(error.message);
      if (error instanceof Error) throw new ConflictException(error.message);
      throw error;
    }
  }
}
