import type { InboxRepository, OutboxMessage } from './message-contracts.js';

export class IdempotentConsumer {
  constructor(
    private readonly consumerName: string,
    private readonly inbox: InboxRepository,
  ) {}

  async handle(
    message: OutboxMessage,
    effect: (message: OutboxMessage) => Promise<string | undefined>,
  ): Promise<'PROCESSED' | 'DUPLICATE'> {
    const acquired = await this.inbox.begin(this.consumerName, message);
    if (!acquired) return 'DUPLICATE';

    try {
      const checksum = await effect(message);
      await this.inbox.complete(this.consumerName, message.eventId, checksum);
      return 'PROCESSED';
    } catch (error) {
      await this.inbox.abandon(this.consumerName, message.eventId);
      throw error;
    }
  }
}
