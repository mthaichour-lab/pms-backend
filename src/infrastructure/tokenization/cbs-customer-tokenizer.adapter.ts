import { ManageTokenization } from '../../modules/tokenization/application/token-vault.js';
import type { CbsCustomerTokenizer } from '../../modules/cbs-ingestion/application/publish-investment-positions.js';

export class CbsCustomerTokenizerAdapter implements CbsCustomerTokenizer {
  constructor(private readonly tokenization: ManageTokenization) {}
  async tokenize(values: readonly string[], context: { batchId: string; correlationId: string }): Promise<readonly string[]> {
    if (values.length === 0) return [];
    const result = await this.tokenization.tokenizeBatch(values, 'CUSTOMER_ID', {
      actorId: 'ingestion-worker', correlationId: context.correlationId,
      idempotencyKey: `cbs-publish:${context.batchId}`, purpose: 'CBS_CORE_PUBLICATION',
    });
    return result.map(value => value.token);
  }
}
