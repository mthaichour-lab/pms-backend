import { IdempotentConsumer } from '../../../src/infrastructure/messaging/idempotent-consumer.js';
import type { InboxRepository, OutboxMessage } from '../../../src/infrastructure/messaging/message-contracts.js';
import type { AuditEventDraft, SignedAuditEvent } from '../../../src/modules/audit/domain/audit-chain.js';

export interface AuditEventAppender {
  append(draft: AuditEventDraft): Promise<SignedAuditEvent>;
}

export class AuditMessageHandler {
  private readonly consumer: IdempotentConsumer;

  constructor(inbox: InboxRepository, private readonly audit: AuditEventAppender) {
    this.consumer = new IdempotentConsumer('audit-worker', inbox);
  }

  handle(message: OutboxMessage): Promise<'PROCESSED' | 'DUPLICATE'> {
    return this.consumer.handle(message, async () => {
      if (message.eventType !== 'pms.audit.workflow-action-recorded.v1' || message.schemaVersion !== 1) {
        throw new TypeError('Unsupported audit workflow event');
      }
      const payload = workflowActionPayload(message.payload);
      const event = await this.audit.append({
        auditEventId: message.eventId,
        correlationId: message.correlationId,
        actorId: payload.actorId,
        technicalIdentity: 'audit-worker',
        ...(payload.sessionId ? { sessionId: payload.sessionId } : {}),
        action: payload.action,
        resourceType: payload.resourceType,
        resourceId: payload.resourceId,
        outcome: 'SUCCESS',
        businessDate: payload.businessDate,
        occurredAt: message.occurredAt,
        sourceApplication: 'pms-api',
        ...(payload.sourceAddress ? { sourceAddress: payload.sourceAddress } : {}),
        justification: payload.justification,
        authorizedChanges: { state: { after: payload.resultState } },
      });
      return event.eventHash;
    });
  }
}

function workflowActionPayload(payload: Readonly<Record<string, unknown>>) {
  const required = ['resourceType', 'resourceId', 'action', 'actorId', 'justification', 'resultState', 'businessDate'] as const;
  for (const field of required) {
    if (typeof payload[field] !== 'string' || payload[field].trim().length === 0) {
      throw new TypeError(`Invalid audit workflow event field: ${field}`);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload['businessDate'] as string)) {
    throw new TypeError('Invalid audit workflow event field: businessDate');
  }
  for (const field of ['sessionId', 'sourceAddress'] as const) {
    if (payload[field] !== undefined && (typeof payload[field] !== 'string' || payload[field].length === 0)) {
      throw new TypeError(`Invalid audit workflow event field: ${field}`);
    }
  }
  return {
    resourceType: (payload['resourceType'] as string).trim(),
    resourceId: (payload['resourceId'] as string).trim(),
    action: (payload['action'] as string).trim(),
    actorId: (payload['actorId'] as string).trim(),
    justification: (payload['justification'] as string).trim(),
    resultState: (payload['resultState'] as string).trim(),
    businessDate: payload['businessDate'] as string,
    sessionId: payload['sessionId'] as string | undefined,
    sourceAddress: payload['sourceAddress'] as string | undefined,
  };
}
