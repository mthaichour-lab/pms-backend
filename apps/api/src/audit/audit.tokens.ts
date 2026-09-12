import type { AuditEventDraft, SignedAuditEvent } from '../../../../src/modules/audit/domain/audit-chain.js';

export const QUERY_AUDIT_TRAIL = Symbol('QUERY_AUDIT_TRAIL');
export const AUDIT_EVENT_WRITER = Symbol('AUDIT_EVENT_WRITER');

export interface AuditEventWriter {
  append(draft: AuditEventDraft): Promise<SignedAuditEvent>;
}
