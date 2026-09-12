import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../migrations/001_token_vault.sql', import.meta.url), 'utf8');
const failures = [];
for (const control of [
  'CREATE SCHEMA IF NOT EXISTS token_vault', 'ciphertext text NOT NULL',
  'encrypted_data_key text NOT NULL', 'search_digest_sha256 text NOT NULL',
  'CREATE TABLE IF NOT EXISTS token_vault.detokenization_audit',
  'detokenization_audit_immutable', 'REVOKE ALL ON SCHEMA token_vault FROM PUBLIC',
]) if (!sql.includes(control)) failures.push(control);
for (const forbidden of ['clear_value', 'plaintext', 'personal_value']) {
  if (sql.toLowerCase().includes(forbidden)) failures.push(`forbidden clear-data column: ${forbidden}`);
}
if (failures.length) {
  console.error(`Token Vault schema verification failed:\n${failures.join('\n')}`); process.exitCode = 1;
} else console.log('Token Vault encrypted storage, blind index, audit immutability and isolation controls verified.');
