import type { PersonalDataClass, TokenizedValue } from '../../modules/tokenization/domain/tokenized-identity.js';
import type { TokenizationContext, TokenVault } from '../../modules/tokenization/application/token-vault.js';

export class HttpTokenVaultAdapter implements TokenVault {
  constructor(private readonly baseUrl: string, private readonly workloadToken: string, private readonly timeoutMs = 5_000) {
    if (!baseUrl.startsWith('https://') && !baseUrl.startsWith('http://127.0.0.1')) throw new TypeError('Token Vault URL must use HTTPS');
    if (!workloadToken) throw new TypeError('Token Vault workload credential is required');
  }

  tokenize(value: string, dataClass: PersonalDataClass, context: TokenizationContext) { return this.request<TokenizedValue>('/v1/tokens', { value, dataClass }, context); }
  tokenizeBatch(values: readonly string[], dataClass: PersonalDataClass, context: TokenizationContext) { return this.request<readonly TokenizedValue[]>('/v1/tokens/batch', { values, dataClass }, context); }
  detokenize(token: string, context: TokenizationContext) { return this.request<string>('/v1/detokenizations', { token }, context); }
  search(searchDigestSha256: string, dataClass: PersonalDataClass, context: TokenizationContext) { return this.request<TokenizedValue | undefined>('/v1/tokens/search', { searchDigestSha256, dataClass }, context); }
  rotate(token: string, context: TokenizationContext) { return this.request<TokenizedValue>('/v1/tokens/rotate', { token }, context); }

  private async request<T>(path: string, body: object, context: TokenizationContext): Promise<T> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST', signal: AbortSignal.timeout(this.timeoutMs),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.workloadToken}`, 'x-correlation-id': context.correlationId, 'idempotency-key': context.idempotencyKey, 'x-actor-id': context.actorId, 'x-purpose': context.purpose },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Token Vault request failed with status ${response.status}`);
    return await response.json() as T;
  }
}
