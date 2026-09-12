import {
  assertPublishableReport, validateRegulatoryReport, type RegulatoryReportSnapshot,
} from '../domain/regulatory-report.js';

export interface RegulatoryReportRepository {
  generate(input: { reportType: string; period: string; actorId: string }, validate: typeof validateRegulatoryReport): Promise<{
    regulatoryReportId: string; state: 'GENERATED'; snapshot: RegulatoryReportSnapshot;
    sourceChecksumSha256: string; outputChecksumSha256: string;
  }>;
  publish(input: {
    regulatoryReportId: string; actorId: string; evidenceDocumentId: string;
    justification: string; idempotencyKey: string;
  }, assertPublishable: typeof assertPublishableReport): Promise<{ regulatoryReportId: string; state: 'PUBLISHED' }>;
}

export class ManageRegulatoryReport {
  constructor(private readonly repository: RegulatoryReportRepository) {}

  generate(reportType: string, period: string, actorId: string) {
    if (!/^[A-Z][A-Z0-9_-]{1,63}$/.test(reportType)) throw new TypeError('Invalid regulatory report type');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new TypeError('Regulatory report period must use YYYY-MM');
    if (!actorId.trim()) throw new TypeError('Report generator is required');
    return this.repository.generate({ reportType, period, actorId }, validateRegulatoryReport);
  }

  publish(input: {
    regulatoryReportId: string; actorId: string; evidenceDocumentId: string;
    justification: string; idempotencyKey: string;
  }) {
    if (!uuid(input.regulatoryReportId)) throw new TypeError('Regulatory report identifier must be a UUID');
    if (input.justification.trim().length < 10) throw new TypeError('Publication justification must contain at least 10 characters');
    if (input.idempotencyKey.length < 16 || input.idempotencyKey.length > 128) {
      throw new TypeError('Publication idempotency key must contain between 16 and 128 characters');
    }
    return this.repository.publish({ ...input, justification: input.justification.trim() }, assertPublishableReport);
  }
}

function uuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
