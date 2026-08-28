import { describe, expect, it, vi } from 'vitest';

import { HttpLandingStorageAdapter } from '../../../src/infrastructure/landing/landing-http.adapter.js';

describe('HttpLandingStorageAdapter', () => {
  it('loads an authenticated object and preserves its metadata', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('document', {
      headers: {
        'content-type': 'application/pdf',
        'content-length': '8',
        'x-original-filename': 'preuve%20client.pdf',
      },
    }));
    const adapter = new HttpLandingStorageAdapter({
      baseUrl: 'https://landing.internal',
      workloadToken: () => 'workload-token',
      fetch,
    });

    const result = await adapter.load('tenant 1/input/file.pdf');

    expect(result.filename).toBe('preuve client.pdf');
    expect(result.mediaType).toBe('application/pdf');
    expect(new TextDecoder().decode(result.bytes)).toBe('document');
    expect(fetch).toHaveBeenCalledWith(
      new URL('https://landing.internal/v1/objects/tenant%201/input/file.pdf'),
      expect.objectContaining({ headers: { authorization: 'Bearer workload-token' } }),
    );
  });

  it('rejects an oversized object before downloading its body', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, {
      headers: {
        'content-type': 'application/pdf',
        'content-length': String(25 * 1024 * 1024 + 1),
        'x-original-filename': 'large.pdf',
      },
    }));
    const adapter = new HttpLandingStorageAdapter({
      baseUrl: 'https://landing.internal', workloadToken: () => 'token', fetch,
    });
    await expect(adapter.load('large.pdf')).rejects.toThrow('exceeds 25 MiB');
  });
});
