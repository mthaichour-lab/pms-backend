import { createHash, randomUUID } from 'node:crypto';
import { ProductTermsVersion, type ProductTermsState } from '../domain/product-terms-version.js';

export interface ProductTermsDraftInput {
  productId: string; effectiveFrom: string; effectiveTo?: string;
  investorNisba: string; bankNisba: string; indicativeTargetRate?: string;
}
export interface ProductTermsRepository {
  findIdempotent(idempotencyKey: string, requestHash: string): Promise<ProductTermsState | undefined>;
  createDraft(input: ProductTermsDraftInput, actorId: string, command: ProductTermsCommand): Promise<ProductTermsState>;
  findById(termsVersionId: string): Promise<ProductTermsState | undefined>;
  publish(state: ProductTermsState, actorId: string, justification: string, correlationId: string, command: ProductTermsCommand): Promise<void>;
}
export interface ProductTermsCommand { idempotencyKey: string; requestHash: string; operation: string; }

export class ManageProductTerms {
  constructor(private readonly repository: ProductTermsRepository) {}

  simulate(input: ProductTermsDraftInput) {
    assertUuid(input.productId, 'Product');
    ProductTermsVersion.draft({ ...input, termsVersionId: '550e8400-e29b-41d4-a716-446655440000', version: 1, createdBy: 'simulation' });
    const canonical = JSON.stringify([input.productId, input.effectiveFrom, input.effectiveTo ?? null, input.investorNisba, input.bankNisba, input.indicativeTargetRate ?? null]);
    return {
      simulationChecksumSha256: createHash('sha256').update(canonical).digest('hex'),
      valid: true as const,
      notice: 'Le taux cible est indicatif et non garanti.',
    };
  }

  async createDraft(input: ProductTermsDraftInput, actorId: string, idempotencyKey: string): Promise<ProductTermsState> {
    if (!actorId.trim()) throw new TypeError('Product terms creator is required');
    this.simulate(input);
    const command = commandFor(idempotencyKey, 'CREATE_TERMS', actorId, [input.productId, input.effectiveFrom, input.effectiveTo ?? '', input.investorNisba, input.bankNisba, input.indicativeTargetRate ?? '']);
    const replay = await this.repository.findIdempotent(command.idempotencyKey, command.requestHash);
    return replay ?? this.repository.createDraft(input, actorId.trim(), command);
  }

  async publish(productId: string, termsVersionId: string, input: { businessDate: string; simulationChecksumSha256: string; retroactiveApprovalId?: string; actorId: string; justification: string; idempotencyKey: string }): Promise<ProductTermsState> {
    assertUuid(productId, 'Product');
    assertUuid(termsVersionId, 'Product terms version');
    if (!input.actorId.trim()) throw new TypeError('Product terms checker is required');
    if (input.justification.trim().length < 10) throw new TypeError('Publication justification must contain at least 10 characters');
    const command = commandFor(input.idempotencyKey, 'PUBLISH_TERMS', input.actorId, [productId, termsVersionId, input.businessDate, input.simulationChecksumSha256, input.retroactiveApprovalId ?? '', input.justification.trim()]);
    const replay = await this.repository.findIdempotent(command.idempotencyKey, command.requestHash);
    if (replay) return replay;
    const state = await this.repository.findById(termsVersionId);
    if (!state) throw new Error(`Product terms not found: ${termsVersionId}`);
    if (state.productId !== productId) throw new Error('Product terms do not belong to the requested product');
    const expectedChecksum = this.simulate(state).simulationChecksumSha256;
    if (input.simulationChecksumSha256 !== expectedChecksum) throw new Error('Simulation checksum does not match the product terms');
    const terms = ProductTermsVersion.restore(state);
    terms.publish(input);
    const published = terms.snapshot();
    await this.repository.publish(published, input.actorId, input.justification.trim(), randomUUID(), command);
    return published;
  }
}

function assertUuid(value: string, label: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new TypeError(`${label} identifier must be a UUID`);
  }
}

function commandFor(idempotencyKey: string, operation: string, actorId: string, values: string[]): ProductTermsCommand {
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) throw new TypeError('Idempotency-Key must contain 8 to 128 safe characters');
  return { idempotencyKey, operation, requestHash: createHash('sha256').update(JSON.stringify([operation, actorId.trim(), ...values])).digest('hex') };
}
