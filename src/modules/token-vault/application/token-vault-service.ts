import { randomBytes } from 'node:crypto';
import type { PersonalDataClass, TokenizedValue } from '../../tokenization/domain/tokenized-identity.js';
import { assertPurpose, assertTokenizedValue } from '../../tokenization/domain/tokenized-identity.js';

export interface EncryptedPayload { ciphertext: string; encryptedDataKey: string; iv: string; authTag: string; keyVersion: string; }
export interface EnvelopeEncryption {
  encrypt(clearValue: string): Promise<EncryptedPayload>;
  decrypt(payload: EncryptedPayload): Promise<string>;
}
export interface BlindIndex { digest(clearValue: string, dataClass: PersonalDataClass): Promise<string>; }
export interface VaultRecord extends EncryptedPayload { token: string; dataClass: PersonalDataClass; searchDigestSha256: string; createdAt: string; rotatedAt?: string; }
export interface TokenVaultRepository {
  insert(record: VaultRecord): Promise<void>;
  findByToken(token: string): Promise<VaultRecord | undefined>;
  findByDigest(searchDigestSha256: string, dataClass: PersonalDataClass): Promise<VaultRecord | undefined>;
  replaceEncryptedPayload(token: string, previousKeyVersion: string, payload: EncryptedPayload): Promise<void>;
}
export interface DetokenizationAudit {
  append(event: { token: string; actorId: string; purpose: string; correlationId: string; outcome: 'SUCCESS' | 'DENIED' | 'FAILURE'; occurredAt: string }): Promise<void>;
}

export class TokenVaultService {
  constructor(
    private readonly repository: TokenVaultRepository,
    private readonly encryption: EnvelopeEncryption,
    private readonly blindIndex: BlindIndex,
    private readonly audit: DetokenizationAudit,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async tokenize(clearValue: string, dataClass: PersonalDataClass): Promise<TokenizedValue> {
    if (!clearValue) throw new TypeError('Clear value is required inside the vault boundary');
    const [payload, digest] = await Promise.all([this.encryption.encrypt(clearValue), this.blindIndex.digest(clearValue, dataClass)]);
    assertDigest(digest);
    const token = `tok_${randomBytes(24).toString('base64url')}`;
    await this.repository.insert({ token, dataClass, searchDigestSha256: digest, ...payload, createdAt: this.now().toISOString() });
    const result = { token, dataClass, vaultKeyVersion: payload.keyVersion }; assertTokenizedValue(result); return result;
  }

  async detokenize(token: string, context: { actorId: string; purpose: string; correlationId: string }): Promise<string> {
    assertContext(context); const record = await this.repository.findByToken(token);
    if (!record) { await this.auditEvent(token, context, 'DENIED'); throw new Error('Vault token not found'); }
    try {
      const clearValue = await this.encryption.decrypt(record);
      if (!clearValue) throw new Error('Vault returned an empty clear value');
      await this.auditEvent(token, context, 'SUCCESS'); return clearValue;
    } catch (error) { await this.auditEvent(token, context, 'FAILURE'); throw error; }
  }

  async search(digest: string, dataClass: PersonalDataClass): Promise<TokenizedValue | undefined> {
    assertDigest(digest); const record = await this.repository.findByDigest(digest, dataClass);
    return record ? { token: record.token, dataClass: record.dataClass, vaultKeyVersion: record.keyVersion } : undefined;
  }

  async rotate(token: string, context: { actorId: string; purpose: string; correlationId: string }): Promise<TokenizedValue> {
    assertContext(context); const record = await this.repository.findByToken(token);
    if (!record) { await this.auditEvent(token, context, 'DENIED'); throw new Error('Vault token not found'); }
    try {
      const clearValue = await this.encryption.decrypt(record);
      const payload = await this.encryption.encrypt(clearValue);
      if (payload.keyVersion === record.keyVersion) throw new Error('KMS did not rotate to a new key version');
      await this.repository.replaceEncryptedPayload(token, record.keyVersion, payload);
      await this.auditEvent(token, context, 'SUCCESS');
      return { token, dataClass: record.dataClass, vaultKeyVersion: payload.keyVersion };
    } catch (error) {
      await this.auditEvent(token, context, 'FAILURE').catch(() => undefined);
      throw error;
    }
  }

  private auditEvent(token: string, context: { actorId: string; purpose: string; correlationId: string }, outcome: 'SUCCESS' | 'DENIED' | 'FAILURE') {
    return this.audit.append({ token, ...context, outcome, occurredAt: this.now().toISOString() });
  }
}

function assertContext(context: { actorId: string; purpose: string; correlationId: string }): void {
  if (!context.actorId.trim()) throw new TypeError('Vault actor is required'); assertPurpose(context.purpose);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(context.correlationId)) throw new TypeError('Vault correlation identifier must be a UUID');
}
function assertDigest(value: string): void { if (!/^[0-9a-f]{64}$/.test(value)) throw new TypeError('Blind index must be a SHA-256 digest'); }
