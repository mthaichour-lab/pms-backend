import { describe, expect, it, vi } from 'vitest';

import { createPmsApiClient, PmsApiProblem } from './client.js';

describe('pms api client', () => {
  it('reads the verified audit trail with an optional limit', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ events: [], integrity: 'HASH_CHAIN', chainValid: true, verifiedCount: 0 }), { status: 200 }),
    );
    const client = createPmsApiClient({ baseUrl: 'https://backend.internal', accessToken: () => 'server-token', fetch: fetchMock });

    await client.getAuditTrail({ correlationId: 'audit-request', traceparent: '00-trace-span-01', limit: 25 });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.internal/api/audit/events?limit=25',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'x-correlation-id': 'audit-request',
          traceparent: '00-trace-span-01',
        }),
      }),
    );
  });

  it('serializes audit filters without confusing request and event correlations', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ events: [], integrity: 'HASH_CHAIN', chainValid: true, verifiedCount: 0 }), { status: 200 }));
    const client = createPmsApiClient({ baseUrl: 'https://backend.internal', accessToken: () => 'server-token', fetch: fetchMock });
    await client.getAuditTrail({ correlationId: 'request-correlation', auditCorrelationId: '65aeb69d-73a7-4f04-9578-5fa8326f654f', action: 'APPROVE_CALCULATION', resourceType: 'CalculationRun', outcome: 'SUCCESS', businessDateFrom: '2026-09-01', businessDateTo: '2026-09-09' });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://backend.internal/api/audit/events?action=APPROVE_CALCULATION&resourceType=CalculationRun&outcome=SUCCESS&correlationId=65aeb69d-73a7-4f04-9578-5fa8326f654f&businessDateFrom=2026-09-01&businessDateTo=2026-09-09');
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual(expect.objectContaining({ 'x-correlation-id': 'request-correlation' }));
  });

  it('requests and reads an asynchronous document archive', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ requestId: 'archive-1', status: 'QUEUED' }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ requestId: 'archive-1', status: 'ARCHIVED' }), { status: 200 }));
    const client = createPmsApiClient({ baseUrl: 'https://backend.internal', accessToken: () => 'server-token', fetch: fetchMock });
    await client.requestDocumentArchive({ correlationId: 'document-request', idempotencyKey: 'document-request-0001', command: { objectKey: 'landing/proof.pdf', businessType: 'SHARIA_DECISION', businessId: 'decision-1', classification: 'CONFIDENTIAL', evidentiary: true } });
    await client.getDocumentArchiveRequest({ requestId: 'archive/1', correlationId: 'document-status' });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://backend.internal/api/documents/archive-requests');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://backend.internal/api/documents/archive-requests/archive%2F1');
  });
  it('scopes a tenor curve with a tokenized customer identifier', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ scope: 'CUSTOMER', points: [] }), { status: 200 }));
    const client = createPmsApiClient({ baseUrl: 'https://backend.internal', accessToken: () => 'server-token', fetch: fetchMock });
    await client.getTenorYieldCurve({ poolId: 'POOL:001', customerToken: 'tok_1234567890abcdef', correlationId: 'curve-request' });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://backend.internal/api/reporting/tenor-curves/POOL%3A001?customerToken=tok_1234567890abcdef');
  });

  it('requests the published profit explanation view without recalculation', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ view: 'SIMPLIFIED', source: {} }), { status: 200 }));
    const client = createPmsApiClient({ baseUrl: 'https://backend.internal', accessToken: () => 'server-token', fetch: fetchMock });
    await client.getProfitExplanation({ runId: 'run/id', accountId: 'account/id', view: 'SIMPLIFIED', correlationId: 'explanation-request' });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://backend.internal/api/reporting/profit-explanations/run%2Fid/accounts/account%2Fid?view=SIMPLIFIED');
  });

  it('reads an audience dashboard with an optional pool scope', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ audience: 'RISK_ALM', generatedAt: '2026-09-08T08:00:00.000Z', items: [], queryDurationMs: 12, requiredItemCount: 8, complete: true, performanceBudgetMs: 3000 }), { status: 200 }),
    );
    const client = createPmsApiClient({ baseUrl: 'https://backend.internal', accessToken: () => 'server-token', fetch: fetchMock });

    await client.getAudienceDashboard({ audience: 'RISK_ALM', poolId: 'POOL:001', correlationId: 'dashboard-request' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.internal/api/reporting/dashboards/RISK_ALM?poolId=POOL%3A001',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('emits and acknowledges an accounting event through the typed lifecycle', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ journalEntryId: 'journal-1', acknowledgementState: 'PENDING' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ acknowledgementState: 'ACKNOWLEDGED' }), { status: 200 }));
    const client = createPmsApiClient({ baseUrl: 'https://backend.internal', accessToken: () => 'server-token', fetch: fetchMock });
    await client.emitAccountingEvent({
      correlationId: 'accounting-event', idempotencyKey: 'accounting-event-0001',
      command: { runId: 'run-1', poolId: 'pool-1', productId: 'product-1', eventType: 'REVENUE', eventId: 'event-1', entityId: 'entity-1', businessDate: '2026-09-08', currencyScale: 2, lines: [{ accountCode: 'POOL:REVENUE', currency: 'DZD', debit: '100', credit: '0' }, { accountCode: 'GL:REVENUE', currency: 'DZD', debit: '0', credit: '100' }] },
    });
    await client.acknowledgeAccountingEvent({ journalEntryId: 'journal/1', correlationId: 'accounting-ack', idempotencyKey: 'accounting-ack-0001', command: { action: 'ACKNOWLEDGED', externalReference: 'GL-2026-001' } });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://backend.internal/api/accounting/events');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://backend.internal/api/accounting/journals/journal%2F1/acknowledgements');
  });

  it('reads the risk dashboard from the latest published run', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ source: 'LATEST_PUBLISHED_RUN' }), { status: 200 }));
    const client = createPmsApiClient({ baseUrl: 'https://backend.internal', accessToken: () => 'server-token', fetch: fetchMock });
    await client.getPublishedRiskDashboard({ poolId: 'POOL/001', correlationId: 'published-risk' });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://backend.internal/api/risk/dashboard/POOL%2F001');
  });

  it('sends server credentials, correlation and idempotency headers', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            poolId: 'pool/1',
            status: 'APPROVED',
            amount: '10.50',
            currency: 'DZD',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    const client = createPmsApiClient({
      baseUrl: 'https://backend.internal',
      accessToken: () => 'server-token',
      fetch: fetchMock,
    });

    await client.approvePoolOperation({
      poolId: 'pool/1',
      correlationId: '5ac1f311-37cc-43bd-aea7-a363ec19ff4e',
      idempotencyKey: 'approval-00000001',
      command: {
        amount: '10.50',
        currency: 'DZD',
        legalEntityId: 'bea',
        branchId: '001',
        workflowStatus: 'PENDING_APPROVAL',
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.internal/api/pools/pool%2F1/operations/approve',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer server-token',
          'idempotency-key': 'approval-00000001',
        }),
      }),
    );
  });

  it('maps problem+json responses to a typed error', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            type: 'about:blank',
            title: 'Forbidden',
            status: 403,
          }),
          { status: 403 },
        ),
      );
    const client = createPmsApiClient({
      baseUrl: 'https://backend.internal',
      accessToken: () => 'token',
      fetch: fetchMock,
    });

    await expect(
      client.approvePoolOperation({
        poolId: 'pool-1',
        correlationId: 'id',
        idempotencyKey: 'approval-00000001',
        command: {
          amount: '10',
          currency: 'DZD',
          legalEntityId: 'bea',
          branchId: '001',
          workflowStatus: 'PENDING_APPROVAL',
        },
      }),
    ).rejects.toBeInstanceOf(PmsApiProblem);
  });
});
