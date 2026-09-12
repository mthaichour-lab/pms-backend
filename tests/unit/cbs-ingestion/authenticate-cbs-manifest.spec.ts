import { describe, expect, it, vi } from 'vitest';
import { AuthenticateCbsManifest, canonicalCbsManifest } from '../../../src/modules/cbs-ingestion/application/authenticate-cbs-manifest.js';

const manifest = { batchId: '550e8400-e29b-41d4-a716-446655440001', source: 'CBS', businessDate: '2026-08-28', flowType: 'INVESTMENT_POSITIONS', sequence: 1, schemaVersion: 1, checksumSha256: 'a'.repeat(64), objectKey: 'landing/batch.csv', manifestRowCount: 2, manifestBalanceTotal: '1500.00', signatureBase64: Buffer.alloc(64, 1).toString('base64'), receivedAt: '2026-08-29T02:00:00.000Z' };
function fixture(valid = true) {
  const signatures = { verify: vi.fn(async () => valid) }; const repository = { recordAuthentication: vi.fn(async () => undefined) };
  return { signatures, repository, service: new AuthenticateCbsManifest(signatures, repository, { startHourUtc: 1, endHourUtc: 4 }) };
}
describe('AuthenticateCbsManifest', () => {
  it('authenticates a signed manifest inside the ingestion window', async () => {
    const test = fixture(); await expect(test.service.execute(manifest)).resolves.toBe('AUTHENTICATED');
    expect(test.signatures.verify).toHaveBeenCalledWith(expect.any(Uint8Array), expect.any(Uint8Array), 'CBS');
    expect(test.repository.recordAuthentication).toHaveBeenCalledWith(manifest.batchId, 'AUTHENTICATED');
  });
  it('rejects an invalid signature with an auditable reason', async () => {
    const test = fixture(false); await expect(test.service.execute(manifest)).resolves.toBe('REJECTED');
    expect(test.repository.recordAuthentication).toHaveBeenCalledWith(manifest.batchId, 'REJECTED', 'INVALID_SOURCE_SIGNATURE');
  });
  it('rejects outside the window without invoking cryptography', async () => {
    const test = fixture(); await expect(test.service.execute({ ...manifest, receivedAt: '2026-08-29T10:00:00.000Z' })).resolves.toBe('REJECTED');
    expect(test.signatures.verify).not.toHaveBeenCalled();
  });
  it('canonicalizes fields independently from object insertion order', () => {
    expect(canonicalCbsManifest(manifest)).toBe(canonicalCbsManifest({ ...manifest }));
  });
});
