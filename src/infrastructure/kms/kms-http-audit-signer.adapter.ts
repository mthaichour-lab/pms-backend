import type { AuditSigner } from '../../modules/audit/domain/audit-chain.js';

export interface KmsHttpAuditSignerOptions {
  baseUrl: string;
  keyId: string;
  workloadToken: () => string | Promise<string>;
  fetch?: typeof globalThis.fetch;
}

export class KmsHttpAuditSigner implements AuditSigner {
  constructor(private readonly options: KmsHttpAuditSignerOptions) {
    if (!options.keyId) throw new TypeError('KMS key identifier is required');
  }

  keyId(): string {
    return this.options.keyId;
  }

  async signSha256Digest(digest: Uint8Array): Promise<Uint8Array> {
    if (digest.byteLength !== 32) throw new TypeError('KMS signer requires a SHA-256 digest');
    const response = await (this.options.fetch ?? globalThis.fetch)(
      new URL(
        `/v1/keys/${encodeURIComponent(this.options.keyId)}/sign-sha256`,
        normalizedBaseUrl(this.options.baseUrl),
      ),
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await this.options.workloadToken()}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ digestBase64: Buffer.from(digest).toString('base64') }),
      },
    );
    if (!response.ok) throw new Error(`KMS signing API returned ${response.status}`);
    const result = (await response.json()) as Record<string, unknown>;
    if (result['keyId'] !== this.options.keyId) {
      throw new Error('KMS signing response key does not match the configured key');
    }
    if (typeof result['signatureBase64'] !== 'string' || result['signatureBase64'].length === 0) {
      throw new TypeError('KMS signing response has no signature');
    }
    const signature = Buffer.from(result['signatureBase64'], 'base64');
    if (signature.byteLength === 0 || signature.toString('base64') !== normalizeBase64(result['signatureBase64'])) {
      throw new TypeError('KMS signing response contains an invalid base64 signature');
    }
    return signature;
  }
}

function normalizeBase64(value: string): string {
  return value.replace(/=+$/, '') + '='.repeat((4 - (value.replace(/=+$/, '').length % 4)) % 4);
}

function normalizedBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}
