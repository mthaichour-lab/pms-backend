import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { createPostgresPool } from '../../../src/infrastructure/persistence/postgres-client.js';

async function migrate(): Promise<void> {
  const databaseUrl = requiredEnvironment('DATABASE_URL');
  const directory = resolve(process.env['MIGRATIONS_DIRECTORY'] ?? 'database/migrations');
  const pool = createPostgresPool({ connectionString: databaseUrl, max: 1, application_name: 'pms-db-migrate' });
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('pms.database.migrations'))");
    await client.query(`CREATE TABLE IF NOT EXISTS public.pms_schema_migration (
      filename text PRIMARY KEY,
      checksum_sha256 text NOT NULL CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$'),
      applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
    )`);
    const files = (await readdir(directory)).filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file)).sort();
    for (const filename of files) {
      const sql = await readFile(resolve(directory, filename), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query<{ checksum_sha256: string }>(
        'SELECT checksum_sha256 FROM public.pms_schema_migration WHERE filename = $1', [filename],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].checksum_sha256 !== checksum) {
          throw new Error(`Applied migration checksum changed: ${filename}`);
        }
        continue;
      }
      console.log(JSON.stringify({ event: 'database.migration.applying', filename }));
      await client.query(sql);
      await client.query(
        'INSERT INTO public.pms_schema_migration (filename, checksum_sha256) VALUES ($1, $2)',
        [filename, checksum],
      );
    }
    console.log(JSON.stringify({ event: 'database.migrations.complete', count: files.length }));
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('pms.database.migrations'))").catch(() => undefined);
    client.release();
    await pool.end();
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

void migrate().catch((error: unknown) => {
  console.error(JSON.stringify({
    event: 'database.migrations.failed',
    error: error instanceof Error ? error.message : 'unknown error',
  }));
  process.exitCode = 1;
});
