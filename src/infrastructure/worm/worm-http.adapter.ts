import { createHash } from 'node:crypto';

import type { WormArchivePort } from '../../modules/documents/application/document-ports.js';

export interface WormHttpOptions {
  baseUrl: string;
  workloadToken: () => string | Promise<string>;
  fetch?: typeof globalThis.fetch;
  retentionClass: string;
}

export class WormHttpAdapter implements WormArchivePort {
  constructor(private readonly options: WormHttpOptions) {}

  async preserve(
    input: Parameters<WormArchivePort['preserve']>[0],
  ): ReturnType<WormArchivePort['preserve']> {
    const manifestJson = JSON.stringify(input.manifest);
    const manifestChecksumSha256 = createHash('sha256').update(manifestJson).digest('hex');
    const response = await (this.options.fetch ?? globalThis.fetch)(
      new URL('/v1/immutable-objects', normalizedBaseUrl(this.options.baseUrl)),
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await this.options.workloadToken()}`,
          'content-type': input.content.mediaType,
          'x-original-filename': encodeURIComponent(input.content.filename),
          'x-idempotency-key': input.idempotencyKey,
          'x-retention-class': this.options.retentionClass,
          'x-manifest-sha256': manifestChecksumSha256,
          'x-manifest-base64': Buffer.from(manifestJson).toString('base64'),
        },
        body: toArrayBuffer(input.content.bytes),
      },
    );
    if (!response.ok) throw new Error(`WORM API returned ${response.status}`);
    const result = (await response.json()) as Record<string, unknown>;
    if (typeof result['objectKey'] !== 'string') {
      throw new TypeError('WORM API response has no object key');
    }
    return { objectKey: result['objectKey'], manifestChecksumSha256 };
  }
}

function normalizedBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const result = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(result).set(bytes);
  return result;
}
