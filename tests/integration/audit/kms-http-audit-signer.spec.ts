import { describe, expect, it, vi } from 'vitest';

import { KmsHttpAuditSigner } from '../../../src/infrastructure/kms/kms-http-audit-signer.adapter.js';

describe('KmsHttpAuditSigner', () => {
  it('signs only the digest through the authenticated KMS boundary', async () => {
    const signature = Buffer.from('hardware-signature');
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({
      keyId: 'audit/key-1', signatureBase64: signature.toString('base64'),
    }));
    const signer = new KmsHttpAuditSigner({
      baseUrl: 'https://kms.internal', keyId: 'audit/key-1',
      workloadToken: () => 'workload-token', fetch,
    });
    const digest = new Uint8Array(32).fill(7);

    await expect(signer.signSha256Digest(digest)).resolves.toEqual(signature);
    expect(signer.keyId()).toBe('audit/key-1');
    expect(fetch).toHaveBeenCalledWith(
      new URL('https://kms.internal/v1/keys/audit%2Fkey-1/sign-sha256'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ digestBase64: Buffer.from(digest).toString('base64') }),
      }),
    );
  });

  it('rejects a signature returned by another key', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({
      keyId: 'wrong-key', signatureBase64: Buffer.from('signature').toString('base64'),
    }));
    const signer = new KmsHttpAuditSigner({
      baseUrl: 'https://kms.internal', keyId: 'audit-key', workloadToken: () => 'token', fetch,
    });
    await expect(signer.signSha256Digest(new Uint8Array(32))).rejects.toThrow('does not match');
  });

  it('rejects inputs that are not SHA-256 digests', async () => {
    const signer = new KmsHttpAuditSigner({
      baseUrl: 'https://kms.internal', keyId: 'audit-key', workloadToken: () => 'token',
    });
    await expect(signer.signSha256Digest(new Uint8Array(31))).rejects.toThrow('SHA-256');
  });
});
