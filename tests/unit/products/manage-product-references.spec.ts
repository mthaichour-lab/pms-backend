import { describe, expect, it } from 'vitest';
import { ManageProductReferences, type ProductReferenceRepository, type ProductReferenceView } from '../../../src/modules/products/application/manage-product-references.js';
import type { ComplianceReferenceState, ProductReferenceKind } from '../../../src/modules/products/domain/compliance-reference.js';

class MemoryReferences implements ProductReferenceRepository {
  refs: ProductReferenceView[]=[];
  async createReference(state:ComplianceReferenceState){ return state; }
  async associate(_productId:string,_referenceId:string,_kind:ProductReferenceKind,_actorId:string) {}
  async list(){ return this.refs; }
  async recordArbitration(){ return { arbitrationId:'018f97ce-1186-4d7d-8e43-29f68d61b7b4' }; }
}
const base=(id:string, source:ProductReferenceView['source']):ProductReferenceView=>({referenceId:id,source,referenceCode:`${source}-1`,version:'1',title:'Reference title',effectiveFrom:'2026-01-01',createdBy:'maker',kind:'SHARIA_DOCUMENT',associatedAt:'2026-01-01T00:00:00Z'});
describe('ManageProductReferences',()=>{
  it('rejects arbitration selecting a lower-priority source',async()=>{
    const repository=new MemoryReferences(); repository.refs=[base('018f97ce-1186-4d7d-8e43-29f68d61b7b1','IFSB'),base('018f97ce-1186-4d7d-8e43-29f68d61b7b2','BA')];
    await expect(new ManageProductReferences(repository).arbitrate({productId:'018f97ce-1186-4d7d-8e43-29f68d61b7b3',selectedReferenceId:repository.refs[0]!.referenceId,rejectedReferenceId:repository.refs[1]!.referenceId,rationale:'A sufficiently detailed arbitration rationale',actorId:'checker'})).rejects.toThrow('priority');
  });
  it('rejects an empty arbitration actor before persistence',async()=>{
    const repository=new MemoryReferences(); repository.refs=[base('018f97ce-1186-4d7d-8e43-29f68d61b7b1','BA'),base('018f97ce-1186-4d7d-8e43-29f68d61b7b2','IFSB')];
    await expect(new ManageProductReferences(repository).arbitrate({productId:'018f97ce-1186-4d7d-8e43-29f68d61b7b3',selectedReferenceId:repository.refs[0]!.referenceId,rejectedReferenceId:repository.refs[1]!.referenceId,rationale:'A sufficiently detailed arbitration rationale',actorId:' '})).rejects.toThrow('actor');
  });
});
