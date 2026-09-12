import type { Pool } from 'pg';
import type { ShariaReviewRepository } from '../../modules/compliance/application/manage-sharia-review.js';
import type { ShariaReviewSnapshot } from '../../modules/compliance/domain/sharia-review.js';

export class PostgresShariaReviewRepository implements ShariaReviewRepository {
  constructor(private readonly pool: Pick<Pool, 'connect'>) {}

  async submit(input: { resourceType: string; resourceId: string; makerId: string }) {
    const client = await this.pool.connect();
    try {
      const result = await client.query<{ review_id: string }>(
        `INSERT INTO compliance.sharia_review (resource_type, resource_id, status, maker_id)
         VALUES ($1, $2, 'SUBMITTED', $3)
         ON CONFLICT (resource_type, resource_id) DO NOTHING RETURNING review_id::text`,
        [input.resourceType, input.resourceId, input.makerId],
      );
      if (!result.rows[0]) throw new Error('A Sharia review already exists for this resource');
      return { reviewId: result.rows[0].review_id, state: 'SUBMITTED' as const };
    } finally { client.release(); }
  }

  async transition(
    reviewId: string, actorId: string,
    transition: (snapshot: ShariaReviewSnapshot) => ShariaReviewSnapshot,
  ) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const currentResult = await client.query<{
        status: ShariaReviewSnapshot['state']; maker_id: string; reviewer_id: string | null;
        approver_id: string | null; opinion: string | null; justification: string | null;
        evidence_document_id: string | null;
      }>(`SELECT status, maker_id, reviewer_id, approver_id, opinion, justification,
                 evidence_document_id::text FROM compliance.sharia_review
          WHERE review_id = $1::uuid FOR UPDATE`, [reviewId]);
      const row = currentResult.rows[0];
      if (!row) throw new Error('Sharia review not found');
      const next = transition({
        state: row.status, makerId: row.maker_id, reviewerId: row.reviewer_id ?? undefined,
        approverId: row.approver_id ?? undefined, opinion: row.opinion ?? undefined,
        justification: row.justification ?? undefined,
        evidenceDocumentId: row.evidence_document_id ?? undefined,
      });
      if (next.state === 'REVIEWED') {
        await client.query(
          `UPDATE compliance.sharia_review SET status = 'REVIEWED', reviewer_id = $2,
             opinion = $3, reviewed_at = clock_timestamp() WHERE review_id = $1::uuid`,
          [reviewId, actorId, next.opinion],
        );
      } else {
        await client.query(
          `UPDATE compliance.sharia_review SET status = $2, approver_id = $3,
             justification = $4, evidence_document_id = $5::uuid, decided_at = clock_timestamp()
           WHERE review_id = $1::uuid`,
          [reviewId, next.state, actorId, next.justification, next.evidenceDocumentId],
        );
      }
      await client.query('COMMIT');
      return { reviewId, state: next.state };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
}
