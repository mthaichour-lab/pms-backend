import { describe, expect, it, vi } from 'vitest';

import { createPmsApiClient, PmsApiProblem } from './client.js';

describe('pms api client', () => {
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

