import type { ProcessClosingGovernance } from '../../../src/modules/closing-workflow/application/process-closing-governance.js';

export class ClosingGovernanceScheduler {
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;

  constructor(
    private readonly governance: ProcessClosingGovernance,
    private readonly intervalMs = 60_000,
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
    this.running = this.governance.execute(this.now())
      .then(({ escalated }) => {
        if (escalated > 0) console.log(JSON.stringify({ event: 'closing.tasks.escalated', count: escalated }));
      })
      .catch((error: unknown) => console.error(JSON.stringify({
        event: 'closing.governance.failed',
        error: error instanceof Error ? error.message : 'unknown error',
      })))
      .finally(() => { this.running = undefined; });
    await this.running;
    return 'EXECUTED';
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.running;
  }
}
