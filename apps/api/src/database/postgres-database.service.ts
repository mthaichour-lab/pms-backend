import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';

import { createPostgresPool } from '../../../../src/infrastructure/persistence/postgres-client.js';

@Injectable()
export class PostgresDatabaseService implements OnApplicationShutdown {
  readonly pool: Pool;

  constructor() {
    const databaseUrl = process.env['DATABASE_URL'];
    if (!databaseUrl) throw new Error('DATABASE_URL is required');
    this.pool = createPostgresPool({
      connectionString: databaseUrl,
      application_name: 'pms-api',
      connectionTimeoutMillis: 1_000,
    });
  }

  async readiness(timeoutMs = 1_000): Promise<void> {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5_000) throw new RangeError('Database readiness timeout is invalid');
    let client: PoolClient | undefined;
    let released = false;
    let timedOut = false;
    let transactionStarted = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const timeoutError = new Error(`Database readiness timed out after ${timeoutMs}ms`);
    const deadline = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        if (client && !released) {
          released = true;
          client.release(timeoutError);
        }
        reject(timeoutError);
      }, timeoutMs);
    });

    const acquisition = this.pool.connect();
    void acquisition.then((lateClient) => {
      if (timedOut && !released) {
        released = true;
        lateClient.release(timeoutError);
      }
    }).catch(() => undefined);

    try {
      client = await Promise.race([acquisition, deadline]);

      const probe = (async () => {
      try {
        await client!.query('BEGIN');
        transactionStarted = true;
        await client!.query("SELECT set_config('statement_timeout', $1, true)", [`${timeoutMs}ms`]);
        await client!.query('SELECT 1 AS ready');
        await client!.query('COMMIT');
        transactionStarted = false;
      } catch (error) {
        if (transactionStarted && !timedOut) await client!.query('ROLLBACK').catch(() => undefined);
        throw error;
      }
      })();

      await Promise.race([probe, deadline]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (client && !released) {
        released = true;
        client.release();
      }
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
