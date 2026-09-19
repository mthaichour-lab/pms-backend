import { describe, expect, it, vi } from 'vitest';
import { PostgresDatabaseService } from '../../../apps/api/src/database/postgres-database.service.js';

describe('PostgresDatabaseService readiness', () => {
  it('uses a constant bounded query with a client timeout', async () => {
    const query = vi.fn(async () => ({ rows: [{ ready: 1 }] }));
    const release = vi.fn();
    const database = Object.create(PostgresDatabaseService.prototype) as PostgresDatabaseService;
    Object.defineProperty(database, 'pool', { value: { connect: async () => ({ query, release }) } });
    await database.readiness(750);
    expect(query.mock.calls).toEqual([
      ['BEGIN'],
      ["SELECT set_config('statement_timeout', $1, true)", ['750ms']],
      ['SELECT 1 AS ready'],
      ['COMMIT'],
    ]);
    expect(release).toHaveBeenCalledOnce();
  });

  it('rejects unbounded timeout values before querying', async () => {
    const connect = vi.fn();
    const database = Object.create(PostgresDatabaseService.prototype) as PostgresDatabaseService;
    Object.defineProperty(database, 'pool', { value: { connect } });
    await expect(database.readiness(5_001)).rejects.toThrow('timeout');
    expect(connect).not.toHaveBeenCalled();
  });

  it('rolls back and releases after PostgreSQL cancels a blocked probe', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql === 'SELECT 1 AS ready') throw new Error('canceling statement due to statement timeout');
      return { rows: [] };
    });
    const release = vi.fn();
    const database = Object.create(PostgresDatabaseService.prototype) as PostgresDatabaseService;
    Object.defineProperty(database, 'pool', { value: { connect: async () => ({ query, release }) } });

    await expect(database.readiness(100)).rejects.toThrow('statement timeout');
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledOnce();
  });

  it('releases a client even when the transaction cannot start', async () => {
    const query = vi.fn(async () => { throw new Error('connection closed'); });
    const release = vi.fn();
    const database = Object.create(PostgresDatabaseService.prototype) as PostgresDatabaseService;
    Object.defineProperty(database, 'pool', { value: { connect: async () => ({ query, release }) } });

    await expect(database.readiness()).rejects.toThrow('connection closed');
    expect(query).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
  });

  it('destroys the client when any readiness protocol query exceeds the deadline', async () => {
    vi.useFakeTimers();
    try {
      const query = vi.fn(() => new Promise(() => undefined));
      const release = vi.fn();
      const database = Object.create(PostgresDatabaseService.prototype) as PostgresDatabaseService;
      Object.defineProperty(database, 'pool', { value: { connect: async () => ({ query, release }) } });

      const readiness = database.readiness(100);
      const rejection = expect(readiness).rejects.toThrow('timed out after 100ms');
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(100);

      await rejection;
      expect(query).toHaveBeenCalledWith('BEGIN');
      expect(release).toHaveBeenCalledOnce();
      expect(release.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    } finally {
      vi.useRealTimers();
    }
  });

  it('bounds connection acquisition and destroys a client acquired after the deadline', async () => {
    vi.useFakeTimers();
    try {
      let resolveConnection!: (client: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> }) => void;
      const release = vi.fn();
      const connect = vi.fn(() => new Promise<{ query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> }>((resolve) => {
        resolveConnection = resolve;
      }));
      const database = Object.create(PostgresDatabaseService.prototype) as PostgresDatabaseService;
      Object.defineProperty(database, 'pool', { value: { connect } });

      const readiness = database.readiness(100);
      const rejection = expect(readiness).rejects.toThrow('timed out after 100ms');
      await vi.advanceTimersByTimeAsync(100);
      await rejection;

      resolveConnection({ query: vi.fn(), release });
      await Promise.resolve();
      expect(release).toHaveBeenCalledOnce();
      expect(release.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    } finally {
      vi.useRealTimers();
    }
  });

  it('destroys the client when rollback itself stalls beyond the global deadline', async () => {
    vi.useFakeTimers();
    try {
      const query = vi.fn((sql: string) => {
        if (sql === 'SELECT 1 AS ready') return Promise.reject(new Error('probe failed'));
        if (sql === 'ROLLBACK') return new Promise(() => undefined);
        return Promise.resolve({ rows: [] });
      });
      const release = vi.fn();
      const database = Object.create(PostgresDatabaseService.prototype) as PostgresDatabaseService;
      Object.defineProperty(database, 'pool', { value: { connect: async () => ({ query, release }) } });

      const readiness = database.readiness(100);
      const rejection = expect(readiness).rejects.toThrow('timed out after 100ms');
      await vi.advanceTimersByTimeAsync(100);

      await rejection;
      expect(query).toHaveBeenLastCalledWith('ROLLBACK');
      expect(release).toHaveBeenCalledOnce();
      expect(release.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ends the pool only once when shutdown is requested repeatedly', async () => {
    const end = vi.fn(async () => undefined);
    const database = Object.create(PostgresDatabaseService.prototype) as PostgresDatabaseService;
    Object.defineProperty(database, 'pool', { value: { end } });

    await Promise.all([database.onApplicationShutdown(), database.onApplicationShutdown()]);

    expect(end).toHaveBeenCalledOnce();
  });
});
