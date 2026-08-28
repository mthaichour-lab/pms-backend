export interface WorkerDefinition {
  name: string;
  queue?: string;
  deadLetterQueue?: string;
  concurrency: number;
}

export function defineWorker(definition: WorkerDefinition): WorkerDefinition {
  if (!/^[a-z][a-z0-9-]+$/.test(definition.name)) {
    throw new TypeError('Worker name must be a lowercase kebab-case identifier');
  }
  if (!Number.isInteger(definition.concurrency) || definition.concurrency < 1) {
    throw new RangeError('Worker concurrency must be a positive integer');
  }
  if (definition.queue && !definition.deadLetterQueue) {
    throw new TypeError('A durable worker queue requires a dead-letter queue');
  }
  return Object.freeze({ ...definition });
}

export function startWorker(definition: WorkerDefinition): void {
  const abortController = new AbortController();
  const shutdown = (signal: NodeJS.Signals) => {
    console.log(JSON.stringify({ event: 'worker.stopping', worker: definition.name, signal }));
    abortController.abort();
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  console.log(
    JSON.stringify({
      event: 'worker.ready',
      worker: definition.name,
      queue: definition.queue,
      deadLetterQueue: definition.deadLetterQueue,
      concurrency: definition.concurrency,
    }),
  );
}
