import { createPublicKey, verify } from 'node:crypto';
import type { CbsSignatureVerifier } from '../../modules/cbs-ingestion/application/authenticate-cbs-manifest.js';

export class Ed25519CbsSignatureVerifier implements CbsSignatureVerifier {
  private readonly keys: ReadonlyMap<string, ReturnType<typeof createPublicKey>>;
  constructor(publicKeysPem: Readonly<Record<string, string>>) {
    if (Object.keys(publicKeysPem).length === 0) throw new TypeError('At least one CBS source public key is required');
    this.keys = new Map(Object.entries(publicKeysPem).map(([source, pem]) => {
      if (!/^[A-Z][A-Z0-9_-]{1,31}$/.test(source)) throw new TypeError('Invalid CBS source identifier');
      const key = createPublicKey(pem); if (key.asymmetricKeyType !== 'ed25519') throw new TypeError(`CBS key for ${source} must be Ed25519`);
      return [source, key];
    }));
  }
  async verify(manifest: Uint8Array, signature: Uint8Array, source: string): Promise<boolean> {
    const key = this.keys.get(source); return key ? verify(null, manifest, key, signature) : false;
  }
}
