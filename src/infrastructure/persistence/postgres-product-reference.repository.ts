import type { Pool, PoolClient } from 'pg';
import type { ProductReferenceRepository, ProductReferenceView } from '../../modules/products/application/manage-product-references.js';
import type { ComplianceReferenceState, ProductReferenceKind } from '../../modules/products/domain/compliance-reference.js';

export class PostgresProductReferenceRepository implements ProductReferenceRepository {
  constructor(private readonly pool: Pool) {}
  async createReference(state: ComplianceReferenceState): Promise<ComplianceReferenceState> {
    await this.pool.query(`INSERT INTO product.compliance_reference
      (reference_id, source, reference_code, version, title, effective_from, effective_to, created_by)
      VALUES ($1::uuid,$2,$3,$4,$5,$6::date,$7::date,$8)`,
      [state.referenceId, state.source, state.referenceCode, state.version, state.title, state.effectiveFrom, state.effectiveTo ?? null, state.createdBy]);
    return state;
  }
  async associate(productId: string, referenceId: string, kind: ProductReferenceKind, actorId: string): Promise<void> {
    await this.pool.query(`INSERT INTO product.product_reference (product_id, reference_id, kind, associated_by)
      VALUES ($1::uuid,$2::uuid,$3,$4) ON CONFLICT DO NOTHING`, [productId, referenceId, kind, actorId]);
  }
  async list(productId: string): Promise<ProductReferenceView[]> {
    const result = await this.pool.query<ReferenceRow>(`SELECT r.reference_id::text, r.source, r.reference_code, r.version, r.title,
      r.effective_from::text, r.effective_to::text, r.created_by, pr.kind, pr.associated_at::text
      FROM product.product_reference pr JOIN product.compliance_reference r ON r.reference_id=pr.reference_id
      WHERE pr.product_id=$1::uuid ORDER BY CASE r.source WHEN 'BA' THEN 1 WHEN 'SHARIA_COMMITTEE' THEN 2 WHEN 'AAOIFI' THEN 3 ELSE 4 END, r.effective_from DESC`, [productId]);
    return result.rows.map(mapRow);
  }
  async recordArbitration(input: { productId: string; selectedReferenceId: string; rejectedReferenceId: string; rationale: string; decidedBy: string }): Promise<{ arbitrationId: string }> {
    const result = await this.pool.query<{ arbitration_id: string }>(`INSERT INTO product.compliance_arbitration
      (product_id,selected_reference_id,rejected_reference_id,rationale,decided_by)
      VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5) RETURNING arbitration_id::text`,
      [input.productId,input.selectedReferenceId,input.rejectedReferenceId,input.rationale,input.decidedBy]);
    return { arbitrationId: result.rows[0]!.arbitration_id };
  }
}

interface ReferenceRow { reference_id:string; source:ProductReferenceView['source']; reference_code:string; version:string; title:string; effective_from:string; effective_to:string|null; created_by:string; kind:ProductReferenceKind; associated_at:string }
function mapRow(row: ReferenceRow): ProductReferenceView { return { referenceId:row.reference_id, source:row.source, referenceCode:row.reference_code, version:row.version, title:row.title, effectiveFrom:row.effective_from, effectiveTo:row.effective_to ?? undefined, createdBy:row.created_by, kind:row.kind, associatedAt:row.associated_at }; }

export async function assertProductPublishable(client: Pick<PoolClient, 'query'>, productId: string, businessDate: string): Promise<void> {
  const result = await client.query<{ kind: ProductReferenceKind }>(`SELECT DISTINCT pr.kind FROM product.product_reference pr
    JOIN product.compliance_reference r ON r.reference_id=pr.reference_id
    WHERE pr.product_id=$1::uuid AND r.effective_from <= $2::date AND (r.effective_to IS NULL OR r.effective_to >= $2::date)`, [productId,businessDate]);
  const kinds = new Set(result.rows.map(row => row.kind));
  const missing = ['CONTRACTUAL_DOCUMENT','REGULATORY_DOCUMENT','SHARIA_DOCUMENT','ACCOUNTING_SCHEMA'].filter(kind => !kinds.has(kind as ProductReferenceKind));
  if (missing.length) throw new Error(`Product publication requires admissible references: ${missing.join(', ')}`);
}
