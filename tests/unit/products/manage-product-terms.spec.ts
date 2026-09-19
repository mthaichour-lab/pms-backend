import { describe, expect, it } from 'vitest';
import { ManageProductTerms, type ProductTermsDraftInput, type ProductTermsRepository } from '../../../src/modules/products/application/manage-product-terms.js';
import type { ProductTermsState } from '../../../src/modules/products/domain/product-terms-version.js';

class MemoryTerms implements ProductTermsRepository {
  state?: ProductTermsState; published = false; commands = new Map<string, { hash: string; state: ProductTermsState }>();
  async findIdempotent(key: string, hash: string) { const command = this.commands.get(key); if (!command) return undefined; if (command.hash !== hash) throw new Error('different product terms command'); return command.state; }
  async createDraft(input: ProductTermsDraftInput, actorId: string, command: { idempotencyKey: string; requestHash: string }): Promise<ProductTermsState> {
    this.state = { ...input, termsVersionId: '550e8400-e29b-41d4-a716-446655440010', version: 1, status: 'DRAFT', createdBy: actorId }; this.commands.set(command.idempotencyKey, { hash: command.requestHash, state: this.state }); return this.state;
  }
  async findById(): Promise<ProductTermsState | undefined> { return this.state; }
  async publish(state: ProductTermsState, _actor: string, _reason: string, _correlation: string, command: { idempotencyKey: string; requestHash: string }): Promise<void> { this.state = state; this.published = true; this.commands.set(command.idempotencyKey, { hash: command.requestHash, state }); }
}

const input = { productId: '550e8400-e29b-41d4-a716-446655440001', effectiveFrom: '2026-09-01', investorNisba: '70', bankNisba: '30', indicativeTargetRate: '4.5' };

describe('ManageProductTerms', () => {
  it('rejects malformed product identifiers before repository access', () => {
    const repository = new MemoryTerms(); const service = new ManageProductTerms(repository);
    expect(() => service.simulate({ ...input, productId: 'not-a-uuid' })).toThrow('Product identifier must be a UUID');
  });

  it('produces a deterministic simulation with a non-guarantee notice', () => {
    const service = new ManageProductTerms(new MemoryTerms());
    expect(service.simulate(input)).toEqual(service.simulate(input));
    expect(service.simulate(input).notice).toContain('non garanti');
  });

  it('publishes only the exact simulated draft', async () => {
    const repository = new MemoryTerms(); const service = new ManageProductTerms(repository);
    const draft = await service.createDraft(input, 'maker', 'terms-create-0001'); const simulation = service.simulate(input);
    const published = await service.publish(draft.productId, draft.termsVersionId, { businessDate: '2026-08-29', simulationChecksumSha256: simulation.simulationChecksumSha256, actorId: 'checker', justification: 'Terms publication approved', idempotencyKey: 'terms-publish-0001' });
    expect(published.status).toBe('PUBLISHED'); expect(repository.published).toBe(true);
  });

  it('rejects a checksum belonging to different terms', async () => {
    const repository = new MemoryTerms(); const service = new ManageProductTerms(repository);
    const draft = await service.createDraft(input, 'maker', 'terms-create-0002');
    await expect(service.publish(draft.productId, draft.termsVersionId, { businessDate: '2026-08-29', simulationChecksumSha256: 'a'.repeat(64), actorId: 'checker', justification: 'Terms publication approved', idempotencyKey: 'terms-publish-0002' })).rejects.toThrow('does not match');
  });

  it('rejects malformed terms identifiers and missing checker before loading state', async () => {
    const service = new ManageProductTerms(new MemoryTerms());
    await expect(service.publish('not-a-uuid', 'also-not-a-uuid', { businessDate: '2026-08-29', simulationChecksumSha256: 'a'.repeat(64), actorId: '', justification: 'Terms publication approved', idempotencyKey: 'terms-publish-0004' })).rejects.toThrow('Product identifier must be a UUID');
  });

  it('replays the same command and rejects key reuse with another payload', async () => {
    const service = new ManageProductTerms(new MemoryTerms());
    const first = await service.createDraft(input, 'maker', 'terms-create-0003');
    expect(await service.createDraft(input, 'maker', 'terms-create-0003')).toEqual(first);
    await expect(service.createDraft({ ...input, bankNisba: '29', investorNisba: '71' }, 'maker', 'terms-create-0003')).rejects.toThrow('different product terms command');
  });
});
