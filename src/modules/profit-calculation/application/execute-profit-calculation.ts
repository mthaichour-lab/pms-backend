import { createHash } from 'node:crypto';

import { Money } from '../../../shared-kernel/money.js';
import {
  allocateProportionally,
  type AllocationResult,
  type AllocationWeight,
} from '../domain/proportional-allocation.js';
import { buildProfitExplanation, type ProfitExplanationInput, type ProfitExplanationOutput } from '../domain/profit-explanation.js';

export interface CalculationRequest {
  runId: string;
  poolId: string;
  businessDate: string;
  rulesVersion: string;
  correlationId: string;
  requestedBy: string;
  runKind?: 'PARALLEL' | 'PRODUCTION';
}

export interface CalculationSnapshot {
  distributableAmount: string;
  currency: string;
  amountScale: number;
  sourceReference: string;
  weights: readonly AllocationWeight[];
  explanationInputs?: readonly Omit<ProfitExplanationInput,'allocatedProfit'|'poolProfit'|'currency'>[];
}

export interface CompletedCalculation {
  inputChecksumSha256: string;
  outputChecksumSha256: string;
  allocations: readonly AllocationResult[];
  explanations: readonly ProfitExplanationOutput[];
}

export interface CalculationExecutionRepository {
  executeAtomically(
    request: CalculationRequest,
    calculate: (snapshot: CalculationSnapshot) => CompletedCalculation,
  ): Promise<{ status: 'CALCULATED' | 'ALREADY_CALCULATED'; outputChecksumSha256: string }>;
}

export class ExecuteProfitCalculation {
  constructor(private readonly repository: CalculationExecutionRepository) {}

  execute(request: CalculationRequest) {
    validateRequest(request);
    return this.repository.executeAtomically(request, (snapshot) => {
      const inputChecksumSha256 = sha256(canonicalJson({
        ...snapshot,
        weights: [...snapshot.weights].sort((left, right) => left.participantId.localeCompare(right.participantId)),
        poolId: request.poolId,
        businessDate: request.businessDate,
        rulesVersion: request.rulesVersion,
      }));
      const allocations = allocateProportionally(
        Money.parse(snapshot.distributableAmount, snapshot.currency, snapshot.amountScale),
        snapshot.weights,
      );
      const richInputs=snapshot.explanationInputs??snapshot.weights.map(item=>({accountId:item.participantId,capitalInvested:item.weight,participationBase:item.weight,eligiblePeriodStart:request.businessDate,eligiblePeriodEnd:request.businessDate,weighting:item.weight,contractualRatio:'100',reservesUsed:'0',taxAmount:'0'}));
      const explanations=allocations.map(allocation=>{const input=richInputs.find(item=>item.accountId===allocation.participantId);if(!input)throw new Error(`Explanation input missing for ${allocation.participantId}`);return buildProfitExplanation({...input,allocatedProfit:allocation.amount,poolProfit:snapshot.distributableAmount,currency:snapshot.currency});});
      const outputChecksumSha256 = sha256(canonicalJson(
        {allocations:[...allocations].sort((left, right) => left.participantId.localeCompare(right.participantId)),explanations:[...explanations].sort((left,right)=>left.accountId.localeCompare(right.accountId))},
      ));
      return { inputChecksumSha256, outputChecksumSha256, allocations, explanations };
    });
  }
}

function validateRequest(request: CalculationRequest): void {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(request.runId) || !uuid.test(request.correlationId)) throw new TypeError('Calculation identifiers must be UUIDs');
  if (!request.poolId.trim() || !request.rulesVersion.trim() || !request.requestedBy.trim()) {
    throw new TypeError('Calculation pool, rules version and requester are required');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.businessDate)) throw new TypeError('Invalid calculation business date');
  if (request.runKind && !['PARALLEL', 'PRODUCTION'].includes(request.runKind)) throw new TypeError('Invalid calculation run kind');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`;
  }
  throw new TypeError('Unsupported calculation snapshot value');
}
