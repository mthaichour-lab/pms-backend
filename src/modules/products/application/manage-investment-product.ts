import { createHash, randomUUID } from 'node:crypto';
import { InvestmentProduct, type InvestmentProductState, type ProductTransition } from '../domain/investment-product.js';

export interface InvestmentProductRepository {
  findIdempotent(idempotencyKey: string, requestHash: string): Promise<InvestmentProductState | undefined>;
  create(state: InvestmentProductState, actorId: string, command: ProductCommand): Promise<InvestmentProductState>;
  findById(productId: string): Promise<InvestmentProductState | undefined>;
  saveTransition(state: InvestmentProductState, transition: ProductTransition, command: ProductCommand): Promise<InvestmentProductState>;
}

export interface ProductCommand { idempotencyKey: string; requestHash: string; operation: string; }

export class ManageInvestmentProduct {
  constructor(private readonly repository: InvestmentProductRepository) {}

  async create(input: Omit<InvestmentProductState, 'productId' | 'status'> & { actorId: string; idempotencyKey: string }): Promise<InvestmentProductState> {
    if (!input.actorId.trim()) throw new TypeError('Product creator is required');
    const command = commandFor(input.idempotencyKey, 'CREATE', input.actorId, [input.code, input.name, input.investorNisba, input.bankNisba, input.shariaReference ?? '']);
    const replay = await this.repository.findIdempotent(command.idempotencyKey, command.requestHash);
    if (replay) return replay;
    const product = InvestmentProduct.draft({ ...input, productId: randomUUID() });
    const state = product.snapshot();
    return this.repository.create(state, input.actorId.trim(), command);
  }

  async get(productId: string): Promise<InvestmentProductState> {
    const state = await this.repository.findById(productId);
    if (!state) throw new Error(`Investment product not found: ${productId}`);
    return state;
  }

  async transition(productId: string, action: 'VALIDATE' | 'PUBLISH' | 'SUSPEND' | 'RESUME' | 'CLOSE', actorId: string, justification: string, idempotencyKey: string) {
    const command = commandFor(idempotencyKey, action, actorId, [productId, justification]);
    return this.apply(productId, command, product => {
      if (action === 'VALIDATE') product.validate(actorId, justification);
      else if (action === 'PUBLISH') product.publish(actorId, justification);
      else if (action === 'SUSPEND') product.suspend(actorId, justification);
      else if (action === 'RESUME') product.resume(actorId, justification);
      else product.close(actorId, justification);
    });
  }

  private async apply(productId: string, command: ProductCommand, operation: (product: InvestmentProduct) => void): Promise<InvestmentProductState> {
    const replay = await this.repository.findIdempotent(command.idempotencyKey, command.requestHash);
    if (replay) return replay;
    const product = InvestmentProduct.restore(await this.get(productId));
    operation(product);
    const transition = product.pullTransition();
    if (!transition) throw new Error('Product transition was not recorded');
    const state = product.snapshot();
    return this.repository.saveTransition(state, transition, command);
  }
}

function commandFor(idempotencyKey: string, operation: string, actorId: string, values: string[]): ProductCommand {
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) throw new TypeError('Idempotency-Key must contain 8 to 128 safe characters');
  const requestHash = createHash('sha256').update(JSON.stringify([operation, actorId.trim(), ...values])).digest('hex');
  return { idempotencyKey, requestHash, operation };
}
