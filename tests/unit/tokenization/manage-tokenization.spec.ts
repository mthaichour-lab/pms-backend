import { describe, expect, it, vi } from 'vitest';
import { ManageTokenization, type TokenVault } from '../../../src/modules/tokenization/application/token-vault.js';

const context = { actorId: 'core-api', correlationId: '550e8400-e29b-41d4-a716-446655440001', idempotencyKey: 'token-command-0001', purpose: 'CUSTOMER_SUPPORT_CASE' };
const tokenized = { token: 'tok_abcdefghijklmnop', dataClass: 'CUSTOMER_ID' as const, vaultKeyVersion: 'v1' };
function vault(): TokenVault { return { tokenize: vi.fn(async () => tokenized), tokenizeBatch: vi.fn(async values => values.map(() => tokenized)), detokenize: vi.fn(async () => 'clear-value'), search: vi.fn(async () => tokenized), rotate: vi.fn(async () => ({ ...tokenized, vaultKeyVersion: 'v2' })) }; }

describe('ManageTokenization', () => {
  it('delegates tokenization without exposing storage concerns', async () => {
    await expect(new ManageTokenization(vault()).tokenize('personal-value', 'CUSTOMER_ID', context)).resolves.toEqual(tokenized);
  });
  it('requires an explicit purpose for detokenization', async () => {
    await expect(new ManageTokenization(vault()).detokenize(tokenized.token, { ...context, purpose: '' })).rejects.toThrow('purpose');
  });
  it('rejects incomplete batch responses', async () => {
    const adapter = vault(); adapter.tokenizeBatch = vi.fn(async () => []);
    await expect(new ManageTokenization(adapter).tokenizeBatch(['a'], 'CUSTOMER_ID', context)).rejects.toThrow('incomplete batch');
  });
  it('requires a non-reversible search digest', async () => {
    await expect(new ManageTokenization(vault()).search('raw-national-id', 'NATIONAL_ID', context)).rejects.toThrow('keyed SHA-256');
  });
});
