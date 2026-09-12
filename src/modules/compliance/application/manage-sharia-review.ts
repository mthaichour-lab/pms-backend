import {
  decideShariaCase, reviewShariaCase, type ShariaReviewSnapshot,
} from '../domain/sharia-review.js';

export interface ShariaReviewRepository {
  submit(input: { resourceType: string; resourceId: string; makerId: string }): Promise<{ reviewId: string; state: 'SUBMITTED' }>;
  transition(
    reviewId: string,
    actorId: string,
    transition: (snapshot: ShariaReviewSnapshot) => ShariaReviewSnapshot,
  ): Promise<{ reviewId: string; state: ShariaReviewSnapshot['state'] }>;
}

export class ManageShariaReview {
  constructor(private readonly repository: ShariaReviewRepository) {}

  submit(resourceType: string, resourceId: string, makerId: string) {
    if (!/^[A-Za-z][A-Za-z0-9_-]{1,63}$/.test(resourceType)) throw new TypeError('Invalid compliance resource type');
    if (!resourceId.trim() || resourceId.length > 128) throw new TypeError('Invalid compliance resource identifier');
    if (!makerId.trim()) throw new TypeError('Compliance maker is required');
    return this.repository.submit({ resourceType, resourceId: resourceId.trim(), makerId });
  }

  review(reviewId: string, reviewerId: string, opinion: string) {
    assertUuid(reviewId);
    return this.repository.transition(reviewId, reviewerId, (snapshot) =>
      reviewShariaCase(snapshot, reviewerId, opinion));
  }

  decide(
    reviewId: string, approverId: string, decision: 'APPROVED' | 'REJECTED',
    justification: string, evidenceDocumentId: string,
  ) {
    assertUuid(reviewId);
    if (!['APPROVED', 'REJECTED'].includes(decision)) throw new TypeError('Invalid Sharia decision');
    return this.repository.transition(reviewId, approverId, (snapshot) =>
      decideShariaCase(snapshot, approverId, decision, justification, evidenceDocumentId));
  }
}

function assertUuid(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new TypeError('Sharia review identifier must be a UUID');
  }
}
