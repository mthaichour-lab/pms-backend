import { describe, expect, it } from 'vitest';
import { ManageInvestmentProduct, type InvestmentProductRepository, type ProductCommand } from '../../../src/modules/products/application/manage-investment-product.js';
import type { InvestmentProductState, ProductTransition } from '../../../src/modules/products/domain/investment-product.js';

class MemoryProducts implements InvestmentProductRepository {
  readonly states = new Map<string, InvestmentProductState>();
  readonly transitions: ProductTransition[] = [];
  readonly commands = new Map<string, { hash: string; state: InvestmentProductState }>();
  async findIdempotent(key: string, hash: string): Promise<InvestmentProductState | undefined> {
    const command = this.commands.get(key); if (!command) return undefined;
    if (command.hash !== hash) throw new Error('different product command'); return command.state;
  }
  async create(state: InvestmentProductState, _actor: string, command: ProductCommand): Promise<InvestmentProductState> { this.states.set(state.productId, { ...state }); this.commands.set(command.idempotencyKey, { hash: command.requestHash, state: { ...state } }); return state; }
  async findById(id: string): Promise<InvestmentProductState | undefined> { return this.states.get(id); }
  async saveTransition(state: InvestmentProductState, transition: ProductTransition, command: ProductCommand): Promise<InvestmentProductState> {
    this.states.set(state.productId, { ...state }); this.transitions.push({ ...transition }); this.commands.set(command.idempotencyKey, { hash: command.requestHash, state: { ...state } });
    return state;
  }
}

describe('ManageInvestmentProduct', () => {
  it('creates and progresses a valid product with audited actors', async () => {
    const repository = new MemoryProducts();
    const service = new ManageInvestmentProduct(repository);
    const created = await service.create({ code: 'WAKALA_01', name: 'Wakala standard', investorNisba: '75', bankNisba: '25', shariaReference: 'FATWA-01', actorId: 'maker', idempotencyKey: 'create-0001' });
    expect(created.status).toBe('DRAFT');
    await service.transition(created.productId, 'VALIDATE', 'maker', 'Parameters reviewed', 'validate-0001');
    const published = await service.transition(created.productId, 'PUBLISH', 'checker', 'Publication approved', 'publish-0001');
    expect(published.status).toBe('PUBLISHED');
    expect(repository.transitions.map(value => value.actorId)).toEqual(['maker', 'checker']);
  });

  it('replays the same command and rejects a changed payload with the same key', async () => {
    const repository = new MemoryProducts(); const service = new ManageInvestmentProduct(repository);
    const input = { code: 'MUDARABA_02', name: 'Moudaraba premium', investorNisba: '80', bankNisba: '20', shariaReference: 'FATWA-02', actorId: 'maker', idempotencyKey: 'create-0002' };
    const first = await service.create(input); const replay = await service.create(input);
    expect(replay.productId).toBe(first.productId);
    await expect(service.create({ ...input, name: 'Changed product' })).rejects.toThrow('different product command');
  });

  it('reports an unknown product', async () => {
    const service = new ManageInvestmentProduct(new MemoryProducts());
    await expect(service.get('550e8400-e29b-41d4-a716-446655440099')).rejects.toThrow('not found');
  });

  it('prevents the validator from publishing their own validation', async () => {
    const repository = new MemoryProducts(); const service = new ManageInvestmentProduct(repository);
    const created = await service.create({ code: 'WAKALA_03', name: 'Wakala checker', investorNisba: '75', bankNisba: '25', shariaReference: 'FATWA-03', actorId: 'maker', idempotencyKey: 'create-0003' });
    await service.transition(created.productId, 'VALIDATE', 'controller', 'Validation completed', 'validate-0003');
    await expect(service.transition(created.productId, 'PUBLISH', 'controller', 'Publication approved', 'publish-0003')).rejects.toThrow('independent checker');
  });
});
