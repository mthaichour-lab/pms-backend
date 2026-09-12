export interface RegulatoryReportSnapshot {
  period: string;
  postedCalculationCount: number;
  reconciliationVarianceCount: number;
  dcrBreachCount: number;
  approvedShariaReviewCount: number;
  rejectedShariaReviewCount: number;
}

export function validateRegulatoryReport(snapshot: RegulatoryReportSnapshot): RegulatoryReportSnapshot {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(snapshot.period)) throw new TypeError('Regulatory report period must use YYYY-MM');
  for (const [name, value] of Object.entries(snapshot).filter(([name]) => name !== 'period')) {
    if (!Number.isSafeInteger(value) || (value as number) < 0) throw new RangeError(`${name} must be a non-negative safe integer`);
  }
  return Object.freeze({ ...snapshot });
}

export function assertPublishableReport(input: {
  state: 'GENERATED' | 'PUBLISHED'; generatorId: string; publisherId: string; evidenceDocumentId: string;
}): void {
  if (input.state !== 'GENERATED') throw new Error('Only a generated report can be published');
  if (!input.publisherId.trim() || input.publisherId === input.generatorId) throw new Error('Report publisher must differ from generator');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.evidenceDocumentId)) {
    throw new TypeError('Report evidence document identifier must be a UUID');
  }
}
