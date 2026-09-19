import { createHash } from 'node:crypto';

import {
  InvestmentSubscription,
  type InvestmentSubscriptionState,
  type SubscriptionEvent,
} from '../domain/investment-subscription.js';

export interface SubscriptionCommandContext {
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly operation: string;
  readonly requestHash: string;
  readonly actorId: string;
  readonly justification: string;
}

export interface SubscriptionMutation {
  readonly state: Readonly<InvestmentSubscriptionState>;
  readonly events: readonly SubscriptionEvent[];
}

export interface InvestmentSubscriptionRepository {
  find(accountId: string): Promise<InvestmentSubscriptionState | undefined>;
  create(
    state: Readonly<InvestmentSubscriptionState>,
    events: readonly SubscriptionEvent[],
    command: SubscriptionCommandContext,
  ): Promise<InvestmentSubscriptionState>;
  transition(
    accountId: string,
    command: SubscriptionCommandContext,
    mutate: (state: InvestmentSubscriptionState) => Promise<SubscriptionMutation>,
  ): Promise<InvestmentSubscriptionState>;
}

export interface CustomerProfitRightsPolicy {
  assertProfitRightsOperationAllowed(customerId: string): Promise<void>;
}

export type SubscriptionAction = {
  type: 'START' | 'ACCEPT' | 'ACTIVATE' | 'DEPOSIT' | 'WITHDRAW' | 'BLOCK' | 'UNBLOCK' | 'RENEW' | 'MATURE' | 'SUCCESSION' | 'CLOSE';
  businessDate: string;
  actorId: string;
  amount?: string;
  reason?: string;
  maturityDate?: string;
  caseReference?: string;
  acceptedAt?: string;
  nonGuaranteeAccepted?: boolean;
  profitSharingMethodAccepted?: boolean;
};

export class ManageInvestmentSubscription {
  constructor(
    private readonly repository: InvestmentSubscriptionRepository,
    private readonly rights: CustomerProfitRightsPolicy,
  ) {}

  async create(
    input: Omit<InvestmentSubscriptionState, 'status' | 'openedOn' | 'closedOn' | 'acceptance'>,
    actorId: string,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<InvestmentSubscriptionState> {
    assertCommandHeaders(actorId, idempotencyKey, correlationId);
    const account = InvestmentSubscription.presimulate(input);
    const businessDate = new Date().toISOString().slice(0, 10);
    const command = commandContext(
      'CREATE_INVESTMENT_SUBSCRIPTION', actorId, idempotencyKey, correlationId,
      { input, actorId }, 'Investment subscription pre-simulation created',
    );
    return this.repository.create(account.snapshot(), [
      { type: 'SIMULATED', businessDate, actorId, details: {} },
    ], command);
  }

  async act(
    accountId: string,
    action: SubscriptionAction,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<InvestmentSubscriptionState> {
    assertCommandHeaders(action.actorId, idempotencyKey, correlationId);
    const command = commandContext(
      `${action.type}_INVESTMENT_SUBSCRIPTION`, action.actorId, idempotencyKey, correlationId,
      { accountId, action: normalizedAction(action) }, actionJustification(action),
    );
    return this.repository.transition(accountId, command, async (state) => {
      if (['ACTIVATE', 'DEPOSIT', 'WITHDRAW', 'RENEW', 'MATURE', 'SUCCESSION', 'CLOSE'].includes(action.type)) {
        await this.rights.assertProfitRightsOperationAllowed(state.customerId);
      }
      const account = InvestmentSubscription.restore(state);
      applyAction(account, action);
      return { state: account.snapshot(), events: account.pendingEvents() };
    });
  }
}

function applyAction(account: InvestmentSubscription, action: SubscriptionAction): void {
  switch (action.type) {
    case 'START': account.startSubscription(action.businessDate, action.actorId); break;
    case 'ACCEPT': account.acceptTerms({
      acceptedAt: action.acceptedAt ?? '', acceptedBy: action.actorId,
      nonGuaranteeAccepted: action.nonGuaranteeAccepted === true,
      profitSharingMethodAccepted: action.profitSharingMethodAccepted === true,
    }, action.businessDate); break;
    case 'ACTIVATE': account.activate(action.businessDate, action.actorId); break;
    case 'DEPOSIT': account.deposit(action.businessDate, action.actorId, action.amount ?? ''); break;
    case 'WITHDRAW': account.withdraw(action.businessDate, action.actorId, action.amount ?? ''); break;
    case 'BLOCK': account.block(action.businessDate, action.actorId, action.reason ?? ''); break;
    case 'UNBLOCK': account.unblock(action.businessDate, action.actorId, action.reason ?? ''); break;
    case 'RENEW': account.renew(action.businessDate, action.actorId, action.maturityDate ?? ''); break;
    case 'MATURE': account.mature(action.businessDate, action.actorId); break;
    case 'SUCCESSION': account.openSuccession(action.businessDate, action.actorId, action.caseReference ?? ''); break;
    case 'CLOSE': account.close(action.businessDate, action.actorId); break;
  }
}

function assertCommandHeaders(actorId: string, idempotencyKey: string, correlationId: string): void {
  if (!actorId.trim()) throw new TypeError('Subscription actor is required');
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) throw new TypeError('Idempotency key is required');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(correlationId)) {
    throw new TypeError('Subscription correlation identifier must be a UUID');
  }
}

function commandContext(
  operation: string,
  actorId: string,
  idempotencyKey: string,
  correlationId: string,
  request: unknown,
  justification: string,
): SubscriptionCommandContext {
  return {
    idempotencyKey, correlationId, operation, actorId, justification,
    requestHash: createHash('sha256').update(canonicalJson(request)).digest('hex'),
  };
}

function normalizedAction(action: SubscriptionAction): Record<string, unknown> {
  return {
    type: action.type, businessDate: action.businessDate, actorId: action.actorId,
    amount: action.amount, reason: action.reason, maturityDate: action.maturityDate,
    caseReference: action.caseReference, acceptedAt: action.acceptedAt,
    nonGuaranteeAccepted: action.nonGuaranteeAccepted,
    profitSharingMethodAccepted: action.profitSharingMethodAccepted,
  };
}

function actionJustification(action: SubscriptionAction): string {
  if ((action.type === 'BLOCK' || action.type === 'UNBLOCK') && action.reason?.trim()) return action.reason.trim();
  return `Investment subscription action ${action.type}`;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string' || typeof value === 'number') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(',')}}`;
  }
  throw new TypeError('Unsupported subscription command value');
}
