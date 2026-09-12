import { readFile, writeFile } from 'node:fs/promises';

const contractUrl = new URL('../openapi/pms-api.v1.json', import.meta.url);
const outputUrl = new URL(
  '../../packages/pms-api-client/src/generated/schema.ts',
  import.meta.url,
);
const contract = JSON.parse(await readFile(contractUrl, 'utf8'));

function typeFor(schema) {
  if (Array.isArray(schema.allOf)) return schema.allOf.map(typeFor).join(' & ');
  if (schema.$ref) return schema.$ref.split('/').at(-1);
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (Array.isArray(schema.type)) return schema.type.map((type) => type === 'null' ? 'null' : typeFor({ ...schema, type })).join(' | ');
  if (schema.type === 'integer' || schema.type === 'number') return 'number';
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'array') return `readonly ${typeFor(schema.items)}[]`;
  if (schema.type === 'object') return objectType(schema);
  return 'string';
}

function objectType(schema) {
  const required = new Set(schema.required ?? []);
  const fields = Object.entries(schema.properties ?? {}).map(
    ([name, property]) =>
      `  readonly ${name}${required.has(name) ? '' : '?'}: ${typeFor(property)};`,
  );
  return `{\n${fields.join('\n')}\n}`;
}

const schemas = Object.entries(contract.components?.schemas ?? {})
  .map(([name, schema]) => `export type ${name} = ${typeFor(schema)};`)
  .join('\n\n');
const operations = Object.values(contract.paths ?? {}).flatMap((pathItem) =>
  ['get', 'post', 'put', 'patch', 'delete'].flatMap((method) =>
    pathItem[method]?.operationId ? [pathItem[method].operationId] : [],
  ),
);
const content =
  `// Generated from contracts/openapi/pms-api.v1.json. Do not edit.\n` +
  `export const apiVersion = ${JSON.stringify(contract.info.version)} as const;\n\n` +
  `export const operationIds = ${JSON.stringify(operations, null, 2)} as const;\n\n` +
  `${schemas}\n`;

if (process.argv.includes('--check')) {
  const existing = await readFile(outputUrl, 'utf8').catch(() => '');
  if (existing !== content) {
    console.error(
      'Generated SDK is stale. Run: pnpm nx generate-sdk pms-contracts',
    );
    process.exitCode = 1;
  } else {
    console.log('Generated SDK matches the OpenAPI contract.');
  }
} else {
  await writeFile(outputUrl, content, 'utf8');
  console.log('Generated SDK schema updated.');
}
