import type {
  ApiStatus,
  ApprovedPoolOperation,
  ApprovePoolOperationCommand,
  CurrencyDefinition,
  InvestmentAccountSnapshot,
  Problem,
} from './generated/schema.js';

export interface PmsApiClientOptions {
  baseUrl: string;
  accessToken: () => string | Promise<string>;
  fetch?: typeof globalThis.fetch;
}

export class PmsApiProblem extends Error {
  constructor(readonly problem: Problem) {
    super(problem.detail ?? problem.title);
    this.name = 'PmsApiProblem';
  }
}

export function createPmsApiClient(options: PmsApiClientOptions) {
  const fetchImplementation = options.fetch ?? globalThis.fetch;

  return {
    async getApiStatus(input: { correlationId: string; traceparent?: string }): Promise<ApiStatus> {
      return request<ApiStatus>('/', {
        method: 'GET',
        correlationId: input.correlationId,
        traceparent: input.traceparent,
      });
    },
    async getEffectiveCurrency(input: {
      code: string;
      businessDate: string;
      correlationId: string;
      traceparent?: string;
    }): Promise<CurrencyDefinition> {
      const query = new URLSearchParams({ businessDate: input.businessDate });
      return request<CurrencyDefinition>(
        `/reference-data/currencies/${encodeURIComponent(input.code)}?${query}`,
        { method: 'GET', correlationId: input.correlationId, traceparent: input.traceparent },
      );
    },
    async getInvestmentAccountSnapshot(input: {
      accountId: string;
      businessDate: string;
      correlationId: string;
      traceparent?: string;
    }): Promise<InvestmentAccountSnapshot> {
      const query = new URLSearchParams({ businessDate: input.businessDate });
      return request<InvestmentAccountSnapshot>(
        `/investment-accounts/${encodeURIComponent(input.accountId)}?${query}`,
        { method: 'GET', correlationId: input.correlationId, traceparent: input.traceparent },
      );
    },
    async approvePoolOperation(input: {
      poolId: string;
      command: ApprovePoolOperationCommand;
      correlationId: string;
      idempotencyKey: string;
      traceparent?: string;
    }): Promise<ApprovedPoolOperation> {
      return request<ApprovedPoolOperation>(
        `/pools/${encodeURIComponent(input.poolId)}/operations/approve`,
        {
          method: 'POST',
          correlationId: input.correlationId,
          idempotencyKey: input.idempotencyKey,
          traceparent: input.traceparent,
          body: JSON.stringify(input.command),
        },
      );
    },
  };

  async function request<T>(
    path: string,
    input: {
      method: 'GET' | 'POST';
      correlationId: string;
      traceparent?: string;
      idempotencyKey?: string;
      body?: string;
    },
  ): Promise<T> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${await options.accessToken()}`,
      'x-correlation-id': input.correlationId,
    };
    if (input.body) headers['content-type'] = 'application/json';
    if (input.idempotencyKey) headers['idempotency-key'] = input.idempotencyKey;
    if (input.traceparent) headers['traceparent'] = input.traceparent;
    const response = await fetchImplementation(`${options.baseUrl}/api${path}`, {
      method: input.method,
      headers,
      body: input.body,
    });
    const body: unknown = await response.json();
    if (!response.ok) throw new PmsApiProblem(body as Problem);
    return body as T;
  }
}
