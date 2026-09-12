import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createPostgresPool } from "../../../src/infrastructure/persistence/postgres-client.js";

async function seed(): Promise<void> {
  const databaseUrl = requiredEnvironment("DATABASE_URL");
  const directory = resolve(process.env.SEEDS_DIRECTORY ?? "database/seeds");
  const pool = createPostgresPool({
    connectionString: databaseUrl,
    max: 1,
    application_name: "pms-db-seed",
  });
  const client = await pool.connect();
  try {
    await client.query(
      "SELECT pg_advisory_lock(hashtext('pms.database.local-seeds'))",
    );
    const files = (await readdir(directory))
      .filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file))
      .sort();
    for (const filename of files) {
      console.log(
        JSON.stringify({ event: "database.seed.applying", filename }),
      );
      await client.query(await readFile(resolve(directory, filename), "utf8"));
    }
    console.log(
      JSON.stringify({ event: "database.seeds.complete", count: files.length }),
    );
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(hashtext('pms.database.local-seeds'))")
      .catch(() => undefined);
    client.release();
    await pool.end();
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

void seed().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      event: "database.seeds.failed",
      error: error instanceof Error ? error.message : "unknown error",
    }),
  );
  process.exitCode = 1;
});
