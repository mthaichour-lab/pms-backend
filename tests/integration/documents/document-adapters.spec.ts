import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { ClamAvAntivirusAdapter } from '../../../src/infrastructure/antivirus/clamav.adapter.js';
import { PaperlessHttpAdapter } from '../../../src/infrastructure/paperless/paperless-http.adapter.js';
import { WormHttpAdapter } from '../../../src/infrastructure/worm/worm-http.adapter.js';

const bytes = new TextEncoder().encode('proof');
const checksum = createHash('sha256').update(bytes).digest('hex');

describe('document infrastructure adapters', () => {
  it('uploads to Paperless, polls the task and verifies the created document', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ task_id: 'task-1' }, { status: 202 }))
      .mockResolvedValueOnce(Response.json({ results: [{ status: 'SUCCESS', related_document: 42 }] }))
      .mockResolvedValueOnce(Response.json({ id: 42, checksum }));
    const adapter = new PaperlessHttpAdapter({
      baseUrl: 'https://paperless.internal',
      token: 'secret',
      fetch: fetchMock,
      wait: vi.fn().mockResolvedValue(undefined),
    });

    await expect(
      adapter.createDocument({
        content: { bytes, filename: 'proof.pdf', mediaType: 'application/pdf' },
        metadata: { businessType: 'DECISION', businessId: '1', classification: 'CONFIDENTIAL', actorId: 'user-1', evidentiary: true },
        checksumSha256: checksum,
        idempotencyKey: 'document-upload-0001',
      }),
    ).resolves.toEqual({ documentId: 42, checksumSha256: checksum });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('maps a ClamAV FOUND response without exposing document content', async () => {
    const adapter = new ClamAvAntivirusAdapter({
      host: 'clamav.internal',
      port: 3310,
      scan: vi.fn().mockResolvedValue('stream: Eicar-Signature FOUND\0'),
    });
    await expect(
      adapter.scan({ bytes, filename: 'proof.pdf', mediaType: 'application/pdf' }),
    ).resolves.toEqual({ clean: false, signature: 'Eicar-Signature' });
  });

  it('sends the original and a hashed manifest to the immutable storage API', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ objectKey: 'worm/1' }));
    const adapter = new WormHttpAdapter({
      baseUrl: 'https://worm.internal',
      workloadToken: () => 'workload-token',
      fetch: fetchMock,
      retentionClass: 'LEGAL-10Y',
    });
    const result = await adapter.preserve({
      content: { bytes, filename: 'proof.pdf', mediaType: 'application/pdf' },
      manifest: { checksumSha256: checksum, evidentiary: true },
      idempotencyKey: 'document-upload-0001',
    });

    expect(result.objectKey).toBe('worm/1');
    expect(result.manifestChecksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://worm.internal/v1/immutable-objects'),
      expect.objectContaining({ headers: expect.objectContaining({ 'x-retention-class': 'LEGAL-10Y' }) }),
    );
  });
});
