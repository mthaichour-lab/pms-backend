import { createHash } from 'node:crypto';

import type { AntivirusPort, DocumentContent } from '../../documents/application/document-ports.js';
import type { CbsBatchDescriptor, CbsBatchRepository } from './register-cbs-batch.js';

export interface CbsLandingStoragePort {
  load(objectKey: string): Promise<DocumentContent>;
}

export class ScanCbsBatch {
  constructor(
    private readonly repository: CbsBatchRepository,
    private readonly landing: CbsLandingStoragePort,
    private readonly antivirus: AntivirusPort,
  ) {}

  async execute(batch: CbsBatchDescriptor): Promise<
    { state: 'SCANNED'; content: DocumentContent } | { state: 'QUARANTINED' }
  > {
    const content = await this.landing.load(batch.objectKey);
    const actualChecksum = createHash('sha256').update(content.bytes).digest('hex');
    if (actualChecksum !== batch.checksumSha256) {
      await this.repository.transition(batch.batchId, 'RECEIVED', 'QUARANTINED', 'CHECKSUM_MISMATCH');
      return { state: 'QUARANTINED' };
    }
    const scan = await this.antivirus.scan(content);
    if (!scan.clean) {
      await this.repository.transition(
        batch.batchId, 'RECEIVED', 'QUARANTINED',
        scan.signature ? `MALWARE:${scan.signature}` : 'MALWARE',
      );
      return { state: 'QUARANTINED' };
    }
    await this.repository.transition(batch.batchId, 'RECEIVED', 'SCANNED');
    return { state: 'SCANNED', content };
  }
}
