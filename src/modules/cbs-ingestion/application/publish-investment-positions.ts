export interface InvestmentPositionPublicationRepository {
  isPublished(batchId: string): Promise<boolean>;
  customerReferences(batchId: string): Promise<readonly string[]>;
  publish(batchId: string, tokensByReference: ReadonlyMap<string, string>): Promise<number>;
}

export interface CbsCustomerTokenizer {
  tokenize(values: readonly string[], context: { batchId: string; correlationId: string }): Promise<readonly string[]>;
}

export class PublishInvestmentPositions {
  constructor(private readonly repository: InvestmentPositionPublicationRepository, private readonly tokenizer: CbsCustomerTokenizer) {}

  async execute(batchId: string, correlationId: string): Promise<number> {
    if (await this.repository.isPublished(batchId)) return 0;
    const references = await this.repository.customerReferences(batchId);
    const uniqueReferences = [...new Set(references)];
    const tokens = await this.tokenizer.tokenize(uniqueReferences, { batchId, correlationId });
    if (tokens.length !== uniqueReferences.length) throw new Error('Token Vault returned an incomplete CBS batch');
    return this.repository.publish(batchId, new Map(uniqueReferences.map((reference, index) => [reference, tokens[index]!] as const)));
  }
}
