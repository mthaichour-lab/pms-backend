import type { DocumentContent } from '../../modules/documents/application/document-ports.js';

const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export interface LandingHttpOptions {
  baseUrl: string;
  workloadToken: () => string | Promise<string>;
  fetch?: typeof globalThis.fetch;
}

export class HttpLandingStorageAdapter {
  constructor(private readonly options: LandingHttpOptions) {}

  async load(objectKey: string): Promise<DocumentContent> {
    if (!objectKey || objectKey.includes('\0')) throw new TypeError('Invalid landing object key');
    const path = objectKey.split('/').map(encodeURIComponent).join('/');
    const response = await (this.options.fetch ?? globalThis.fetch)(
      new URL(`/v1/objects/${path}`, normalizedBaseUrl(this.options.baseUrl)),
      {
        method: 'GET',
        cache: 'no-store',
        headers: { authorization: `Bearer ${await this.options.workloadToken()}` },
      },
    );
    if (!response.ok) throw new Error(`Landing API returned ${response.status}`);
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_DOCUMENT_BYTES) {
      throw new RangeError('Landing object exceeds 25 MiB');
    }
    const filenameHeader = response.headers.get('x-original-filename');
    if (!filenameHeader) throw new TypeError('Landing response has no original filename');
    const filename = decodeFilename(filenameHeader);
    const mediaType = response.headers.get('content-type')?.split(';', 1)[0]?.trim();
    if (!mediaType) throw new TypeError('Landing response has no content type');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_DOCUMENT_BYTES) throw new RangeError('Landing object exceeds 25 MiB');
    return { bytes, filename, mediaType };
  }
}

function decodeFilename(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new TypeError('Landing response has an invalid original filename');
  }
}

function normalizedBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}
