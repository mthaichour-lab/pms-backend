export type ShariaReviewState = 'SUBMITTED' | 'REVIEWED' | 'APPROVED' | 'REJECTED';

export interface ShariaReviewSnapshot {
  state: ShariaReviewState;
  makerId: string;
  reviewerId?: string;
  approverId?: string;
  opinion?: string;
  justification?: string;
  evidenceDocumentId?: string;
}

export function reviewShariaCase(
  current: ShariaReviewSnapshot, reviewerId: string, opinion: string,
): ShariaReviewSnapshot {
  if (current.state !== 'SUBMITTED') throw new Error(`Sharia case cannot be reviewed from ${current.state}`);
  if (!reviewerId.trim() || reviewerId === current.makerId) throw new Error('Maker cannot review their own Sharia case');
  if (opinion.trim().length < 10) throw new TypeError('Sharia opinion must contain at least 10 characters');
  return { ...current, state: 'REVIEWED', reviewerId, opinion: opinion.trim() };
}

export function decideShariaCase(
  current: ShariaReviewSnapshot, approverId: string, decision: 'APPROVED' | 'REJECTED',
  justification: string, evidenceDocumentId: string,
): ShariaReviewSnapshot {
  if (current.state !== 'REVIEWED') throw new Error(`Sharia case cannot be decided from ${current.state}`);
  if (!approverId.trim() || approverId === current.makerId || approverId === current.reviewerId) {
    throw new Error('Sharia approver must differ from maker and reviewer');
  }
  if (justification.trim().length < 10) throw new TypeError('Decision justification must contain at least 10 characters');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(evidenceDocumentId)) {
    throw new TypeError('Evidence document identifier must be a UUID');
  }
  return { ...current, state: decision, approverId, justification: justification.trim(), evidenceDocumentId };
}
