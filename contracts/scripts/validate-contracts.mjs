import { readFile } from 'node:fs/promises';

const openApi = JSON.parse(
  await readFile(
    new URL('../openapi/pms-api.v1.json', import.meta.url),
    'utf8',
  ),
);
const asyncApi = JSON.parse(
  await readFile(
    new URL('../asyncapi/pms-events.v1.json', import.meta.url),
    'utf8',
  ),
);
const errors = [];

if (!openApi.openapi?.startsWith('3.')) errors.push('OpenAPI 3.x is required');
if (!openApi.info?.version) errors.push('OpenAPI info.version is required');
for (const [path, pathItem] of Object.entries(openApi.paths ?? {})) {
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    const operation = pathItem[method];
    if (!operation) continue;
    if (!operation.operationId)
      errors.push(`${method.toUpperCase()} ${path}: operationId is required`);
    if (!operation.responses?.default)
      errors.push(
        `${method.toUpperCase()} ${path}: default problem response is required`,
      );
    const parameters = [
      ...(pathItem.parameters ?? []),
      ...(operation.parameters ?? []),
    ];
    if (
      !parameters.some((parameter) =>
        parameter.$ref?.endsWith('/CorrelationId'),
      )
    )
      errors.push(
        `${method.toUpperCase()} ${path}: X-Correlation-ID is required`,
      );
    if (
      ['post', 'put', 'patch', 'delete'].includes(method) &&
      !parameters.some((parameter) =>
        parameter.$ref?.endsWith('/IdempotencyKey'),
      )
    )
      errors.push(
        `${method.toUpperCase()} ${path}: Idempotency-Key is required`,
      );
  }
}

if (!asyncApi.asyncapi?.startsWith('3.'))
  errors.push('AsyncAPI 3.x is required');
if (!asyncApi.info?.version) errors.push('AsyncAPI info.version is required');
for (const [name, message] of Object.entries(
  asyncApi.components?.messages ?? {},
)) {
  if (!message.messageId)
    errors.push(`AsyncAPI message ${name}: messageId is required`);
  if (!message.payload)
    errors.push(`AsyncAPI message ${name}: payload is required`);
}
for (const address of [
  'pms.calculation.requested.v1',
  'pms.cbs.batch.received.v1',
  'pms.closing.requested.v1',
  'pms.document.archive-requested.v1',
]) {
  if (
    !Object.values(asyncApi.channels ?? {}).some(
      (channel) => channel.address === address,
    )
  ) {
    errors.push(`AsyncAPI channel is missing: ${address}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('OpenAPI and AsyncAPI contracts are structurally valid.');
}
