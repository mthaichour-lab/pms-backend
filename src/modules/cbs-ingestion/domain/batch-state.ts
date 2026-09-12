export const cbsBatchStates = [
  'RECEIVED', 'AUTHENTICATED', 'SCANNED', 'STAGED', 'VALIDATED', 'APPROVED', 'PUBLISHED',
  'QUARANTINED', 'REJECTED', 'PARTIALLY_REJECTED', 'FAILED', 'CANCELLED',
] as const;

export type CbsBatchState = (typeof cbsBatchStates)[number];

const transitions: Readonly<Record<CbsBatchState, readonly CbsBatchState[]>> = {
  RECEIVED: ['AUTHENTICATED', 'REJECTED', 'FAILED', 'CANCELLED'],
  AUTHENTICATED: ['SCANNED', 'QUARANTINED', 'FAILED', 'CANCELLED'],
  SCANNED: ['STAGED', 'QUARANTINED', 'FAILED', 'CANCELLED'],
  STAGED: ['VALIDATED', 'REJECTED', 'PARTIALLY_REJECTED', 'FAILED', 'CANCELLED'],
  VALIDATED: ['APPROVED', 'REJECTED', 'PARTIALLY_REJECTED', 'CANCELLED'],
  APPROVED: ['PUBLISHED', 'FAILED', 'CANCELLED'],
  PUBLISHED: [], QUARANTINED: [], REJECTED: [], PARTIALLY_REJECTED: [], FAILED: [], CANCELLED: [],
};

export function assertBatchTransition(from: CbsBatchState, to: CbsBatchState): void {
  if (!transitions[from].includes(to)) throw new Error(`Invalid CBS batch transition: ${from} -> ${to}`);
}
