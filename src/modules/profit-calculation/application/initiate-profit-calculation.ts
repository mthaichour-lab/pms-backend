import type { CalculationRequest } from './execute-profit-calculation.js';

export type ParticipantWeightBasis = 'LATEST_POSITION' | 'SUBSCRIPTION_LEDGER_BALANCE';

export interface ActiveSubscriptionParticipantBasis {
  type: 'ACTIVE_SUBSCRIPTIONS';
  weightBasis: ParticipantWeightBasis;
}

export interface InitiateCalculationRequest extends CalculationRequest {
  participantBasis: ActiveSubscriptionParticipantBasis;
}

export interface CalculationInitiationResult {
  runId: string;
  status: 'DRAFT';
  dispatchStatus: 'QUEUED' | 'ALREADY_QUEUED';
}

export type CalculationInitiationErrorCode =
  | 'CALCULATION_RUN_CONFLICT'
  | 'POOL_NOT_ACTIVE'
  | 'PARTICIPANT_BASIS_UNAVAILABLE'
  | 'PARTICIPANT_BASIS_INVALID'
  | 'RECOGNIZED_INCOME_UNAVAILABLE'
  | 'CHARGE_POLICY_MISSING'
  | 'DISTRIBUTABLE_AMOUNT_NOT_POSITIVE';

export class CalculationInitiationError extends Error {
  constructor(
    readonly code: CalculationInitiationErrorCode,
    message: string,
    readonly requiredAction: string,
  ) {
    super(message);
    this.name = 'CalculationInitiationError';
  }
}

export interface CalculationInitiationRepository {
  prepareAndEnqueueAtomically(request: InitiateCalculationRequest): Promise<CalculationInitiationResult>;
}

export class InitiateProfitCalculation {
  constructor(private readonly repository: CalculationInitiationRepository) {}

  execute(request: InitiateCalculationRequest): Promise<CalculationInitiationResult> {
    validateRequest(request);
    return this.repository.prepareAndEnqueueAtomically(request);
  }
}

function validateRequest(request: InitiateCalculationRequest): void {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(request.runId) || !uuid.test(request.correlationId)) {
    throw new TypeError('Calculation run and correlation identifiers must be UUIDs');
  }
  if (!/^[A-Z0-9_-]{2,32}$/.test(request.poolId)) throw new TypeError('Invalid calculation pool');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.businessDate)) throw new TypeError('Invalid calculation business date');
  if (!request.rulesVersion.trim() || !request.requestedBy.trim()) {
    throw new TypeError('Calculation rules version and requester are required');
  }
  if (request.runKind !== undefined && !['PARALLEL', 'PRODUCTION'].includes(request.runKind)) {
    throw new TypeError('Invalid calculation run kind');
  }
  if (request.participantBasis?.type !== 'ACTIVE_SUBSCRIPTIONS') {
    throw new TypeError('Calculation participant basis must be ACTIVE_SUBSCRIPTIONS');
  }
  if (!['LATEST_POSITION', 'SUBSCRIPTION_LEDGER_BALANCE'].includes(request.participantBasis.weightBasis)) {
    throw new TypeError('Invalid calculation participant weight basis');
  }
}
