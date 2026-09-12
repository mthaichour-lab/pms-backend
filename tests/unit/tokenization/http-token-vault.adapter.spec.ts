import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpTokenVaultAdapter } from '../../../src/infrastructure/tokenization/http-token-vault.adapter.js';

const context = { actorId: 'core-api', correlationId: '550e8400-e29b-41d4-a716-446655440001', idempotencyKey: 'token-command-0001', purpose: 'CUSTOMER_SUPPORT_CASE' };

describe('HttpTokenVaultAdapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requires TLS outside loopback', () => {
    expect(() => new HttpTokenVaultAdapter('http://vault.internal', 'credential')).toThrow('HTTPS');
  });

  it('propagates workload identity, purpose, correlation and idempotency', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ token: 'tok_abcdefghijklmnop', dataClass: 'CUSTOMER_ID', vaultKeyVersion: 'v1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await new HttpTokenVaultAdapter('https://vault.internal', 'workload-secret').tokenize('clear-sensitive-value', 'CUSTOMER_ID', context);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init!.headers).toMatchObject({ authorization: 'Bearer workload-secret', 'x-purpose': context.purpose, 'idempotency-key': context.idempotencyKey });
    expect(init!.body).toContain('clear-sensitive-value');
  });

  it('does not include a sensitive response body in failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('clear-sensitive-value', { status: 500 })));
    await expect(new HttpTokenVaultAdapter('https://vault.internal', 'credential').detokenize('tok_abcdefghijklmnop', context))
      .rejects.toThrow('status 500');
    await expect(new HttpTokenVaultAdapter('https://vault.internal', 'credential').detokenize('tok_abcdefghijklmnop', context))
      .rejects.not.toThrow('clear-sensitive-value');
  });
});
