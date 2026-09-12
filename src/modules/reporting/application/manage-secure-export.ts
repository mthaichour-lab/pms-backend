import type { ExportDataset, ExportFormat, ExportScope, ExportStatus } from '../domain/secure-export.js';
import { approveMassExport, assertExportDatasetSafe, exportChecksum, initialExportStatus } from '../domain/secure-export.js';

export interface CreateSecureExportCommand { reportType: string; format: ExportFormat; scope: ExportScope; filters?: Readonly<Record<string, string>>; requesterId: string; idempotencyKey: string }
export interface SecureExportRepository {
  create(command: CreateSecureExportCommand, status: ExportStatus): Promise<{ exportId: string; status: ExportStatus }>;
  approve(exportId: string, approverId: string, idempotencyKey: string, decide: typeof approveMassExport): Promise<{ status: ExportStatus }>;
  generate(exportId: string, actorId: string, dataset: ExportDataset, checksum: string, idempotencyKey: string): Promise<{ exportId: string; status: 'GENERATED'; checksumSha256: string }>;
}
export class ManageSecureExport {
  constructor(private readonly repository: SecureExportRepository) {}
  create(command: CreateSecureExportCommand) {
    if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(command.reportType) || !command.requesterId.trim() || command.idempotencyKey.length < 16) throw new TypeError('Export report, requester and idempotency key are required');
    if (!['PDF','XLSX','CSV','API'].includes(command.format) || !['SINGLE','BULK'].includes(command.scope)) throw new TypeError('Unsupported export format or scope');
    return this.repository.create(command, initialExportStatus(command.scope));
  }
  approve(exportId: string, approverId: string, idempotencyKey: string) {
    validateAction(exportId, approverId, idempotencyKey); return this.repository.approve(exportId, approverId, idempotencyKey, approveMassExport);
  }
  generate(exportId: string, actorId: string, dataset: ExportDataset, idempotencyKey: string) {
    validateAction(exportId, actorId, idempotencyKey); assertExportDatasetSafe(dataset); return this.repository.generate(exportId, actorId, dataset, exportChecksum(dataset), idempotencyKey);
  }
}
function validateAction(exportId:string,actorId:string,key:string){if(!/^[0-9a-f-]{36}$/i.test(exportId)||!actorId.trim()||key.length<16)throw new TypeError('Export identifier, actor and idempotency key are required');}
