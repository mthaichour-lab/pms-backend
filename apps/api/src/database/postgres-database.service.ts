import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import type { Pool } from 'pg';

import { createPostgresPool } from '../../../../src/infrastructure/persistence/postgres-client.js';

@Injectable()
export class PostgresDatabaseService implements OnApplicationShutdown {
  readonly pool: Pool;

  constructor() {
    const databaseUrl = process.env['DATABASE_URL'];
    if (!databaseUrl) throw new Error('DATABASE_URL is required');
    this.pool = createPostgresPool({ connectionString: databaseUrl, application_name: 'pms-api' });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
