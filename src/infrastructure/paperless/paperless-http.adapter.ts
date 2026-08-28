import type { PaperlessPort } from '../../modules/documents/application/document-ports.js';

export interface PaperlessHttpOptions {
  baseUrl: string;
  token: string;
  fetch?: typeof globalThis.fetch;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
  wait?: (milliseconds: number) => Promise<void>;
}

export class PaperlessHttpAdapter implements PaperlessPort {
  private readonly fetchImplementation: typeof globalThis.fetch;
  private readonly wait: (milliseconds: number) => Promise<void>;

  constructor(private readonly options: PaperlessHttpOptions) {
    this.fetchImplementation = options.fetch ?? globalThis.fetch;
    this.wait = options.wait ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async createDocument(
    input: Parameters<PaperlessPort['createDocument']>[0],
  ): ReturnType<PaperlessPort['createDocument']> {
    const form = new FormData();
    form.set(
      'document',
      new Blob([toArrayBuffer(input.content.bytes)], {
        type: input.content.mediaType,
      }),
      input.content.filename,
    );
    form.set('title', `${input.metadata.businessType}-${input.metadata.businessId}`);
    form.set('created', new Date().toISOString().slice(0, 10));

    const upload = await this.request('/api/documents/post_document/', {
      method: 'POST',
      headers: { 'idempotency-key': input.idempotencyKey },
      body: form,
    });
    const taskId = taskIdentifier(await upload.json());
    const documentId = await this.waitForDocument(taskId);
    const document = await this.request(`/api/documents/${documentId}/`, { method: 'GET' });
    const details = (await document.json()) as Record<string, unknown>;
    if (typeof details['checksum'] !== 'string') {
      throw new TypeError('Paperless document response has no checksum');
    }
    return { documentId, checksumSha256: details['checksum'] };
  }

  private async waitForDocument(taskId: string): Promise<number> {
    const attempts = this.options.maxPollAttempts ?? 30;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const response = await this.request(
        `/api/tasks/?task_id=${encodeURIComponent(taskId)}`,
        { method: 'GET' },
      );
      const task = firstTask(await response.json());
      const documentId = task['related_document'];
      if (typeof documentId === 'number' && documentId > 0) return documentId;
      if (task['status'] === 'FAILURE') {
        throw new Error(`Paperless consumption failed: ${safeTaskMessage(task)}`);
      }
      await this.wait(this.options.pollIntervalMs ?? 1000);
    }
    throw new Error(`Paperless consumption timed out for task ${taskId}`);
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('authorization', `Token ${this.options.token}`);
    headers.set('accept', 'application/json');
    const response = await this.fetchImplementation(
      new URL(path, normalizedBaseUrl(this.options.baseUrl)),
      { ...init, headers },
    );
    if (!response.ok) {
      throw new Error(`Paperless API returned ${response.status}`);
    }
    return response;
  }
}

function normalizedBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function taskIdentifier(value: unknown): string {
  if (typeof value === 'string' && value.length > 0) return value;
  if (value && typeof value === 'object') {
    const taskId = (value as Record<string, unknown>)['task_id'];
    if (typeof taskId === 'string' && taskId.length > 0) return taskId;
  }
  throw new TypeError('Paperless upload response has no task identifier');
}

function firstTask(value: unknown): Record<string, unknown> {
  if (Array.isArray(value) && value[0] && typeof value[0] === 'object') {
    return value[0] as Record<string, unknown>;
  }
  if (value && typeof value === 'object') {
    const results = (value as Record<string, unknown>)['results'];
    if (Array.isArray(results) && results[0] && typeof results[0] === 'object') {
      return results[0] as Record<string, unknown>;
    }
  }
  throw new TypeError('Paperless task response is empty');
}

function safeTaskMessage(task: Record<string, unknown>): string {
  const message = typeof task['result'] === 'string' ? task['result'] : 'unknown error';
  return message.slice(0, 300);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const result = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(result).set(bytes);
  return result;
}
