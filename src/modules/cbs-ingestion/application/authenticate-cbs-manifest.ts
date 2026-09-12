import type { CbsBatchDescriptor } from './register-cbs-batch.js';

export interface SignedCbsManifest extends CbsBatchDescriptor {
  signatureBase64: string;
  receivedAt: string;
}
export interface CbsSignatureVerifier {
  verify(canonicalManifest: Uint8Array, signature: Uint8Array, source: string): Promise<boolean>;
}
export interface CbsAuthenticationRepository {
  recordAuthentication(batchId: string, result: 'AUTHENTICATED' | 'REJECTED', reason?: string): Promise<void>;
}

export class AuthenticateCbsManifest {
  constructor(
    private readonly signatures: CbsSignatureVerifier,
    private readonly repository: CbsAuthenticationRepository,
    private readonly window: { startHourUtc: number; endHourUtc: number },
  ) {
    if (![window.startHourUtc, window.endHourUtc].every(value => Number.isInteger(value) && value >= 0 && value <= 23)) {
      throw new TypeError('CBS ingestion window hours must be between 0 and 23');
    }
  }

  async execute(manifest: SignedCbsManifest): Promise<'AUTHENTICATED' | 'REJECTED'> {
    validate(manifest);
    const receivedAt = new Date(manifest.receivedAt);
    if (!insideWindow(receivedAt.getUTCHours(), this.window)) {
      await this.repository.recordAuthentication(manifest.batchId, 'REJECTED', 'OUTSIDE_INGESTION_WINDOW');
      return 'REJECTED';
    }
    const signature = Buffer.from(manifest.signatureBase64, 'base64');
    if (signature.byteLength < 32 || !await this.signatures.verify(canonicalBytes(manifest), signature, manifest.source)) {
      await this.repository.recordAuthentication(manifest.batchId, 'REJECTED', 'INVALID_SOURCE_SIGNATURE');
      return 'REJECTED';
    }
    await this.repository.recordAuthentication(manifest.batchId, 'AUTHENTICATED');
    return 'AUTHENTICATED';
  }
}

export function canonicalCbsManifest(manifest: CbsBatchDescriptor): string {
  return JSON.stringify({
    batchId: manifest.batchId, businessDate: manifest.businessDate,
    checksumSha256: manifest.checksumSha256, flowType: manifest.flowType,
    objectKey: manifest.objectKey, schemaVersion: manifest.schemaVersion,
    sequence: manifest.sequence, source: manifest.source,
    manifestRowCount: manifest.manifestRowCount, manifestBalanceTotal: manifest.manifestBalanceTotal,
  });
}
function canonicalBytes(manifest: CbsBatchDescriptor): Uint8Array { return new TextEncoder().encode(canonicalCbsManifest(manifest)); }
function insideWindow(hour: number, window: { startHourUtc: number; endHourUtc: number }): boolean {
  return window.startHourUtc <= window.endHourUtc
    ? hour >= window.startHourUtc && hour <= window.endHourUtc
    : hour >= window.startHourUtc || hour <= window.endHourUtc;
}
function validate(manifest: SignedCbsManifest): void {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(manifest.signatureBase64)) throw new TypeError('Invalid CBS signature encoding');
  const received = new Date(manifest.receivedAt);
  if (Number.isNaN(received.valueOf()) || received.toISOString() !== manifest.receivedAt) throw new TypeError('Invalid CBS reception timestamp');
}
