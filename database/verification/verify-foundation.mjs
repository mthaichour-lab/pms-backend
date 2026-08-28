import { readFile } from 'node:fs/promises';

const migration = await readFile(
  new URL('../migrations/001_platform_foundation.sql', import.meta.url),
  'utf8',
);
const outboxLeaseMigration = await readFile(
  new URL('../migrations/002_outbox_leases.sql', import.meta.url),
  'utf8',
);
const auditSignatureMigration = await readFile(
  new URL('../migrations/003_audit_signatures.sql', import.meta.url),
  'utf8',
);
const requiredFragments = [
  'CREATE SCHEMA IF NOT EXISTS iam_ref',
  'CREATE SCHEMA IF NOT EXISTS integration',
  'CREATE SCHEMA IF NOT EXISTS document',
  'CREATE SCHEMA IF NOT EXISTS audit',
  'CREATE TABLE IF NOT EXISTS iam_ref.access_grant',
  'CREATE TABLE IF NOT EXISTS integration.outbox_event',
  'CREATE TABLE IF NOT EXISTS integration.inbox_message',
  'CREATE TABLE IF NOT EXISTS document.document_reference',
  'CREATE TABLE IF NOT EXISTS audit.event',
  'BEFORE UPDATE OR DELETE ON audit.event',
  'numeric(30, 12)',
];
const missing = requiredFragments.filter((fragment) => !migration.includes(fragment));
for (const fragment of ['locked_by text', 'locked_until timestamptz']) {
  if (!outboxLeaseMigration.includes(fragment)) missing.push(fragment);
}
for (const fragment of ['signing_key_id text NOT NULL', 'signature_base64 text NOT NULL']) {
  if (!auditSignatureMigration.includes(fragment)) missing.push(fragment);
}

if (missing.length > 0) {
  console.error(`Foundation migration is incomplete:\n${missing.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Foundation migration contains all mandatory controls.');
}
