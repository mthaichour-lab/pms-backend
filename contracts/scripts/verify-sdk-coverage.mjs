import { readFile } from 'node:fs/promises';

const contract = JSON.parse(await readFile(new URL('../openapi/pms-api.v1.json', import.meta.url), 'utf8'));
const client = await readFile(new URL('../../packages/pms-api-client/src/client.ts', import.meta.url), 'utf8');
const operations = Object.values(contract.paths).flatMap((item) => Object.values(item).map((operation) => operation.operationId).filter(Boolean));
const missing = operations.filter((operation) => !new RegExp(`async\\s+${operation}\\s*\\(`).test(client));
const baseline = 0;
if (missing.length > baseline) {
  console.error(`SDK coverage regressed: ${missing.length} missing operations, baseline ${baseline}.`);
  console.error(missing.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`SDK operation coverage: ${operations.length - missing.length}/${operations.length}; remaining baseline debt: ${missing.length}.`);
}
