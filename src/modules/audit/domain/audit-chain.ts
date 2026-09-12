import { createHash } from 'node:crypto';

export interface AuditEventDraft {
  auditEventId: string;
  correlationId: string;
  actorId: string;
  technicalIdentity: string;
  sessionId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  outcome: 'SUCCESS' | 'DENIED' | 'FAILURE';
  businessDate: string;
  occurredAt: string;
  sourceApplication: string;
  sourceAddress?: string;
  justification?: string;
  runId?: string;
  batchId?: string;
  documentReferenceId?: string;
  authorizedChanges?: Readonly<Record<string, unknown>>;
}

export interface AuditSigner {
  keyId(): string;
  signSha256Digest(digest: Uint8Array): Promise<Uint8Array>;
}

export interface SignedAuditEvent extends AuditEventDraft {
  previousHash?: string;
  eventHash: string;
  signingKeyId: string;
  signatureBase64: string;
}

export async function createSignedAuditEvent(
  draft: AuditEventDraft,
  previousHash: string | undefined,
  signer: AuditSigner,
): Promise<SignedAuditEvent> {
  const eventHash = calculateAuditHash(draft, previousHash);
  const signature = await signer.signSha256Digest(Buffer.from(eventHash, 'hex'));
  if (signature.byteLength === 0) throw new Error('Audit signer returned an empty signature');
  return {
    ...draft,
    previousHash,
    eventHash,
    signingKeyId: signer.keyId(),
    signatureBase64: Buffer.from(signature).toString('base64'),
  };
}

export function calculateAuditHash(
  draft: AuditEventDraft,
  previousHash: string | undefined,
): string {
  if (previousHash && !/^[a-f0-9]{64}$/.test(previousHash)) {
    throw new TypeError('Previous audit hash is invalid');
  }
  const chainPayload = { ...draft, previousHash: previousHash ?? null };
  return createHash('sha256').update(canonicalJson(chainPayload)).digest('hex');
}

export function verifyAuditHash(event: SignedAuditEvent): boolean {
  const {
    eventHash,
    signingKeyId: _signingKeyId,
    signatureBase64: _signatureBase64,
    previousHash,
    ...draft
  } = event;
  const expected = calculateAuditHash(draft, previousHash);
  return eventHash === expected;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Audit payload contains a non-finite number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(',')}}`;
  }
  throw new TypeError('Audit payload contains an unsupported value');
}
