import { assertPurpose, assertTokenizedValue, type PersonalDataClass, type TokenizedValue } from '../domain/tokenized-identity.js';

export interface TokenizationContext { actorId: string; correlationId: string; idempotencyKey: string; purpose: string; }
export interface TokenVault {
  tokenize(value: string, dataClass: PersonalDataClass, context: TokenizationContext): Promise<TokenizedValue>;
  tokenizeBatch(values: readonly string[], dataClass: PersonalDataClass, context: TokenizationContext): Promise<readonly TokenizedValue[]>;
  detokenize(token: string, context: TokenizationContext): Promise<string>;
  search(searchDigestSha256: string, dataClass: PersonalDataClass, context: TokenizationContext): Promise<TokenizedValue | undefined>;
  rotate(token: string, context: TokenizationContext): Promise<TokenizedValue>;
}

export class ManageTokenization {
  constructor(private readonly vault: TokenVault) {}

  async tokenize(value: string, dataClass: PersonalDataClass, context: TokenizationContext): Promise<TokenizedValue> {
    validateContext(context); if (!value) throw new TypeError('Value to tokenize is required');
    const result = await this.vault.tokenize(value, dataClass, context); assertTokenizedValue(result); return result;
  }

  async tokenizeBatch(values: readonly string[], dataClass: PersonalDataClass, context: TokenizationContext): Promise<readonly TokenizedValue[]> {
    validateContext(context);
    if (values.length < 1 || values.length > 1000 || values.some(value => !value)) throw new TypeError('Tokenization batch must contain 1 to 1000 non-empty values');
    const results = await this.vault.tokenizeBatch(values, dataClass, context);
    if (results.length !== values.length) throw new Error('Token Vault returned an incomplete batch');
    results.forEach(assertTokenizedValue); return results;
  }

  async detokenize(token: string, context: TokenizationContext): Promise<string> {
    validateContext(context); assertPurpose(context.purpose); assertToken(token);
    const clearValue = await this.vault.detokenize(token, context);
    if (!clearValue) throw new Error('Token Vault returned an empty clear value'); return clearValue;
  }

  async search(searchDigestSha256: string, dataClass: PersonalDataClass, context: TokenizationContext) {
    validateContext(context);
    if (!/^[0-9a-f]{64}$/.test(searchDigestSha256)) throw new TypeError('Search requires a keyed SHA-256 digest');
    const result = await this.vault.search(searchDigestSha256, dataClass, context); if (result) assertTokenizedValue(result); return result;
  }

  async rotate(token: string, context: TokenizationContext): Promise<TokenizedValue> {
    validateContext(context); assertPurpose(context.purpose); assertToken(token);
    const result = await this.vault.rotate(token, context); assertTokenizedValue(result); return result;
  }
}

function validateContext(context: TokenizationContext): void {
  if (!context.actorId.trim()) throw new TypeError('Token Vault actor identity is required');
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(context.idempotencyKey)) throw new TypeError('Token Vault idempotency key is required');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(context.correlationId)) throw new TypeError('Token Vault correlation identifier must be a UUID');
  assertPurpose(context.purpose);
}
function assertToken(token: string): void { assertTokenizedValue({ token, dataClass: 'CUSTOMER_ID', vaultKeyVersion: 'validation' }); }
