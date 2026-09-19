import { certifyOpeningBalances, type OpeningBalanceEvidence } from '../domain/opening-balance-certification.js';

export interface OpeningBalanceCertificationRepository {
  save(certification: ReturnType<typeof certifyOpeningBalances>): Promise<{ status: 'CERTIFIED' }>;
}

export class CertifyOpeningBalances {
  constructor(private readonly repository: OpeningBalanceCertificationRepository) {}

  execute(command: {
    certificationId: string;
    signedBy: string;
    signedAt: string;
    correlationId?: string;
    lines: readonly OpeningBalanceEvidence[];
  }) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(command.certificationId)) {
      throw new TypeError('Opening balance certification identifier must be a UUID');
    }
    return this.repository.save(certifyOpeningBalances(command));
  }
}
