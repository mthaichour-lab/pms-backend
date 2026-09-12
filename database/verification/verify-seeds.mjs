import { readdir, readFile } from "node:fs/promises";

const directory = new URL("../seeds/", import.meta.url);
const files = (await readdir(directory))
  .filter((file) => file.endsWith(".sql"))
  .sort();
const failures = [];

if (files.length === 0) failures.push("no local seed file found");
for (const filename of files) {
  if (!/^\d{3}_local_[a-z0-9_]+\.sql$/.test(filename))
    failures.push(`invalid local seed filename: ${filename}`);
  const sql = await readFile(new URL(filename, directory), "utf8");
  for (const fragment of ["BEGIN;", "COMMIT;", "ON CONFLICT"]) {
    if (!sql.includes(fragment))
      failures.push(`${filename}: missing ${fragment}`);
  }
}

const corpus = await Promise.all(
  files.map((filename) => readFile(new URL(filename, directory), "utf8")),
).then((contents) => contents.join("\n"));
for (const poolId of ["GLOBAL_POOL", "REAL_ESTATE", "EQUIPMENT"]) {
  if (!corpus.includes(`'${poolId}'`))
    failures.push(`missing demo pool: ${poolId}`);
}
for (const forbidden of ["@gmail.", "@yahoo.", "-----BEGIN PRIVATE KEY-----"]) {
  if (corpus.includes(forbidden))
    failures.push(`forbidden seed content: ${forbidden}`);
}

if (failures.length) {
  console.error(`Local seed verification failed:\n${failures.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`${files.length} idempotent local seed file verified.`);
}
