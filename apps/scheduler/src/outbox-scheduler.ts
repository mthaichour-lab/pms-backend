import type { OutboxRelay } from '../../../src/infrastructure/messaging/outbox-relay.js';

export class OutboxScheduler {
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;

  constructor(
    private readonly relay: OutboxRelay,
    private readonly intervalMs = 1000,
    private readonly batchSize = 100,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  start(): void {
    if (this.timer) return;
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), this.intervalMs);
    this.timer.unref();
  }

  async runOnce(): Promise<'EXECUTED' | 'SKIPPED'> {
    if (this.running) return 'SKIPPED';
    this.running = this.relay
      .runBatch(this.batchSize, this.now())
      .then((result) => {
        if (result.published.length > 0 || result.failed.length > 0) {
          console.log(
            JSON.stringify({ event: 'outbox.batch.completed', ...result }),
          );
        }
      })
      .catch((error: unknown) => {
        console.error(
          JSON.stringify({
            event: 'outbox.batch.failed',
            error: error instanceof Error ? error.message : 'unknown error',
          }),
        );
      })
      .finally(() => {
        this.running = undefined;
      });
    await this.running;
    return 'EXECUTED';
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.running;
  }
}
