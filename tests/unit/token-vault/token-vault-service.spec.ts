import { describe, expect, it, vi } from 'vitest';
import { TokenVaultService, type DetokenizationAudit, type EnvelopeEncryption, type TokenVaultRepository, type VaultRecord } from '../../../src/modules/token-vault/application/token-vault-service.js';

const encrypted = { ciphertext: 'cipher', encryptedDataKey: 'wrapped-key', iv: 'iv', authTag: 'tag', keyVersion: 'v1' };
const context = { actorId: 'authorized-service', purpose: 'CUSTOMER_SUPPORT_CASE', correlationId: '550e8400-e29b-41d4-a716-446655440001' };
function fixtures(record?: VaultRecord) {
  const repository: TokenVaultRepository = { insert: vi.fn(async () => undefined), findByToken: vi.fn(async () => record), findByDigest: vi.fn(async () => record), replaceEncryptedPayload: vi.fn(async () => undefined) };
  const encryption: EnvelopeEncryption = { encrypt: vi.fn(async () => encrypted), decrypt: vi.fn(async () => 'clear-value') };
  const audit: DetokenizationAudit = { append: vi.fn(async () => undefined) };
  return { repository, encryption, audit, service: new TokenVaultService(repository, encryption, { digest: vi.fn(async () => 'a'.repeat(64)) }, audit, () => new Date('2026-08-29T00:00:00Z')) };
}

describe('TokenVaultService', () => {
  it('persists only envelope-encrypted material and a blind index', async () => {
    const test = fixtures(); const result = await test.service.tokenize('clear-value', 'CUSTOMER_ID');
    expect(result.token).toMatch(/^tok_/); expect(test.repository.insert).toHaveBeenCalledWith(expect.objectContaining(encrypted));
    expect(JSON.stringify(vi.mocked(test.repository.insert).mock.calls)).not.toContain('clear-value');
  });
  it('audits successful detokenization with purpose but not clear data', async () => {
    const record = { token: 'tok_abcdefghijklmnop', dataClass: 'CUSTOMER_ID' as const, searchDigestSha256: 'a'.repeat(64), ...encrypted, createdAt: '2026-08-29T00:00:00.000Z' };
    const test = fixtures(record); await expect(test.service.detokenize(record.token, context)).resolves.toBe('clear-value');
    expect(test.audit.append).toHaveBeenCalledWith(expect.objectContaining({ token: record.token, purpose: context.purpose, outcome: 'SUCCESS' }));
    expect(JSON.stringify(vi.mocked(test.audit.append).mock.calls)).not.toContain('clear-value');
  });
  it('audits denied lookup and never attempts decryption', async () => {
    const test = fixtures(); await expect(test.service.detokenize('tok_abcdefghijklmnop', context)).rejects.toThrow('not found');
    expect(test.audit.append).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'DENIED' })); expect(test.encryption.decrypt).not.toHaveBeenCalled();
  });
});
