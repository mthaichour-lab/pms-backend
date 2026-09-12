import { createHash } from 'node:crypto';

export interface AcceptedClosingRisk {
  anomalyId: string;
  acceptanceReference: string;
  rationale: string;
}

export interface ClosingEvidenceInput {
  closingId: string;
  workflowStatus: 'CLOSED';
  stepEventIds: readonly string[];
  approvalActionIds: readonly string[];
  rejectionIds: readonly string[];
  acceptedRisks: readonly AcceptedClosingRisk[];
  generatedAt: string;
}

export interface ClosingEvidenceManifest extends ClosingEvidenceInput {
  formatVersion: 1;
  checksumSha256: string;
}

export function buildClosingEvidenceManifest(input: ClosingEvidenceInput): ClosingEvidenceManifest {
  if (!input.closingId.trim()) throw new TypeError('closingId is required');
  if (!Number.isFinite(Date.parse(input.generatedAt))) throw new TypeError('generatedAt must be an ISO date');
  for (const risk of input.acceptedRisks) {
    if (!risk.anomalyId.trim() || !risk.acceptanceReference.trim() || !risk.rationale.trim()) {
      throw new TypeError('Accepted risks require anomaly, acceptance reference and rationale');
    }
  }
  const canonical = {
    formatVersion: 1 as const,
    ...input,
    stepEventIds: [...input.stepEventIds].sort(),
    approvalActionIds: [...input.approvalActionIds].sort(),
    rejectionIds: [...input.rejectionIds].sort(),
    acceptedRisks: [...input.acceptedRisks].sort((a, b) => a.anomalyId.localeCompare(b.anomalyId)),
  };
  return {
    ...canonical,
    checksumSha256: createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),
  };
}
