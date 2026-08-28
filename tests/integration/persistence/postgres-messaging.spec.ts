import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import type { SqlClient } from '../../../src/infrastructure/persistence/postgres-client.js';
import { PostgresInboxRepository } from '../../../src/infrastructure/persistence/postgres-inbox.repository.js';
import { PostgresOutboxRepository } from '../../../src/infrastructure/persistence/postgres-outbox.repository.js';

describe('PostgreSQL messaging repositories', () => {
  it('claims Outbox rows atomically with SKIP LOCKED and a lease owner', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          event_id: '1d858fa9-8e21-457c-b3e8-a6c0329071c9',
          aggregate_type: 'CalculationRun',
          aggregate_id: 'run-1',
          event_type: 'pms.calculation.requested.v1',
          schema_version: 1,
          correlation_id: '5e0829b7-f5c9-4e38-a2fa-a98f69520553',
          causation_id: null,
          payload: { runId: 'run-1' },
          occurred_at: new Date('2026-08-28T00:00:00.000Z'),
          available_at: new Date('2026-08-28T00:00:00.000Z'),
          created_at: new Date('2026-08-28T00:00:00.000Z'),
          publish_attempts: 0,
        },
      ],
      rowCount: 1,
    } as QueryResult);
    const repository = new PostgresOutboxRepository({ query } as SqlClient, 'scheduler-1');

    await expect(repository.claimPending(25, '2026-08-28T00:00:00.000Z')).resolves.toHaveLength(1);
    expect(query.mock.calls[0]?.[0]).toContain('FOR UPDATE SKIP LOCKED');
    expect(query.mock.calls[0]?.[1]).toEqual([
      '2026-08-28T00:00:00.000Z',
      25,
      'scheduler-1',
      60,
    ]);
  });

  it('uses the Inbox primary key to reject duplicates', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 } as unknown as QueryResult);
    const repository = new PostgresInboxRepository({ query } as SqlClient);

    await expect(
      repository.begin('document-worker', {
        eventId: '1d858fa9-8e21-457c-b3e8-a6c0329071c9',
        eventType: 'pms.document.archive-requested.v1',
        schemaVersion: 1,
        aggregateType: 'Document',
        aggregateId: 'document-1',
        correlationId: '5e0829b7-f5c9-4e38-a2fa-a98f69520553',
        occurredAt: '2026-08-28T00:00:00.000Z',
        payload: {},
      }),
    ).resolves.toBe(false);
    expect(query.mock.calls[0]?.[0]).toContain('ON CONFLICT (consumer_name, message_id) DO NOTHING');
  });
});
