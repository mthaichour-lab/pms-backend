import { randomUUID } from 'node:crypto';
import { ComplianceReference, compliancePriority, requiredProductReferenceKinds, type ComplianceReferenceState, type ComplianceSource, type ProductReferenceKind } from '../domain/compliance-reference.js';

export interface ProductReferenceView extends ComplianceReferenceState { kind: ProductReferenceKind; associatedAt: string; }
export interface ProductReferenceRepository {
  createReference(state: ComplianceReferenceState): Promise<ComplianceReferenceState>;
  associate(productId: string, referenceId: string, kind: ProductReferenceKind, actorId: string): Promise<void>;
  list(productId: string): Promise<ProductReferenceView[]>;
  recordArbitration(input: { productId: string; selectedReferenceId: string; rejectedReferenceId: string; rationale: string; decidedBy: string }): Promise<{ arbitrationId: string }>;
}

export class ManageProductReferences {
  constructor(private readonly repository: ProductReferenceRepository) {}
  create(input: { source: ComplianceSource; referenceCode: string; version: string; title: string; effectiveFrom: string; effectiveTo?: string; actorId: string }) {
    const state = ComplianceReference.create({ ...input, referenceId: randomUUID(), createdBy: input.actorId }).snapshot();
    return this.repository.createReference(state);
  }
  async associate(productId: string, referenceId: string, kind: ProductReferenceKind, actorId: string): Promise<{ associated: true }> {
    assertUuid(productId, 'Product');
    assertUuid(referenceId, 'Compliance reference');
    if (!requiredProductReferenceKinds.includes(kind)) throw new TypeError('Unknown product reference kind');
    if (!actorId.trim()) throw new TypeError('Association actor is required');
    await this.repository.associate(productId, referenceId, kind, actorId.trim());
    return { associated: true };
  }
  list(productId: string) { assertUuid(productId, 'Product'); return this.repository.list(productId); }
  async arbitrate(input: { productId: string; selectedReferenceId: string; rejectedReferenceId: string; rationale: string; actorId: string }) {
    assertUuid(input.productId, 'Product');
    assertUuid(input.selectedReferenceId, 'Selected compliance reference');
    assertUuid(input.rejectedReferenceId, 'Rejected compliance reference');
    if (input.selectedReferenceId === input.rejectedReferenceId) throw new TypeError('Arbitration references must be different');
    if (!input.actorId.trim()) throw new TypeError('Arbitration actor is required');
    const refs = await this.repository.list(input.productId);
    const selected = refs.find(reference => reference.referenceId === input.selectedReferenceId);
    const rejected = refs.find(reference => reference.referenceId === input.rejectedReferenceId);
    if (!selected || !rejected) throw new Error('Arbitration references must be associated with the product');
    if (compliancePriority(selected.source) < compliancePriority(rejected.source)) throw new Error('Arbitration cannot override BA > Comité Charia > AAOIFI > IFSB priority');
    if (input.rationale.trim().length < 20) throw new TypeError('Arbitration rationale must contain at least 20 characters');
    return this.repository.recordArbitration({ productId: input.productId, selectedReferenceId: input.selectedReferenceId, rejectedReferenceId: input.rejectedReferenceId, rationale: input.rationale.trim(), decidedBy: input.actorId.trim() });
  }
}

function assertUuid(value: string, label: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new TypeError(`${label} identifier must be a UUID`);
  }
}
