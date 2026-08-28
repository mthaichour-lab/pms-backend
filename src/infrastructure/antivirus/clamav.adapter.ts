import { createConnection } from 'node:net';

import type {
  AntivirusPort,
  DocumentContent,
} from '../../modules/documents/application/document-ports.js';

export interface ClamAvOptions {
  host: string;
  port: number;
  timeoutMs?: number;
  scan?: (content: Uint8Array) => Promise<string>;
}

export class ClamAvAntivirusAdapter implements AntivirusPort {
  constructor(private readonly options: ClamAvOptions) {}

  async scan(content: DocumentContent): ReturnType<AntivirusPort['scan']> {
    const response = await (this.options.scan
      ? this.options.scan(content.bytes)
      : scanWithClamAv(content.bytes, this.options));
    const normalized = response.replace(/\0/g, '').trim();
    if (normalized.endsWith('OK')) return { clean: true };
    const found = /:\s*(.+)\s+FOUND$/.exec(normalized);
    if (found) return { clean: false, signature: found[1] };
    throw new Error(`Unexpected ClamAV response: ${normalized.slice(0, 200)}`);
  }
}

function scanWithClamAv(content: Uint8Array, options: ClamAvOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: options.host, port: options.port });
    const response: Buffer[] = [];
    socket.setTimeout(options.timeoutMs ?? 10_000);
    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      for (let offset = 0; offset < content.byteLength; offset += 64 * 1024) {
        const chunk = Buffer.from(content.subarray(offset, offset + 64 * 1024));
        const size = Buffer.allocUnsafe(4);
        size.writeUInt32BE(chunk.byteLength);
        socket.write(size);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on('data', (chunk: Buffer) => response.push(chunk));
    socket.on('end', () => resolve(Buffer.concat(response).toString('utf8')));
    socket.on('timeout', () => socket.destroy(new Error('ClamAV scan timed out')));
    socket.on('error', reject);
  });
}
