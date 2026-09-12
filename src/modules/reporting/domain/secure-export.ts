import { createHash } from 'node:crypto';

export type ExportFormat = 'PDF' | 'XLSX' | 'CSV' | 'API';
export type ExportScope = 'SINGLE' | 'BULK';
export type ExportStatus = 'APPROVED' | 'PENDING_REINFORCED_APPROVAL' | 'GENERATED';
export interface ExportColumn { key: string; label: string; personalData?: boolean }
export interface ExportDataset { columns: readonly ExportColumn[]; rows: readonly Readonly<Record<string, string | number | boolean | null>>[] }

export function initialExportStatus(scope: ExportScope): ExportStatus {
  return scope === 'BULK' ? 'PENDING_REINFORCED_APPROVAL' : 'APPROVED';
}

export function approveMassExport(status: ExportStatus, scope: ExportScope, requesterId: string, approverId: string): ExportStatus {
  if (scope !== 'BULK' || status !== 'PENDING_REINFORCED_APPROVAL') throw new Error('Only a pending bulk export can receive reinforced approval');
  if (!approverId.trim() || approverId === requesterId) throw new Error('Bulk export approval requires a distinct checker');
  return 'APPROVED';
}

export function assertExportDatasetSafe(dataset: ExportDataset): void {
  if (!dataset.columns.length) throw new TypeError('Export requires at least one column');
  const keys = new Set<string>();
  for (const column of dataset.columns) {
    if (!/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(column.key) || !column.label.trim() || keys.has(column.key)) throw new TypeError('Export columns must be unique and valid');
    keys.add(column.key);
  }
  for (const row of dataset.rows) for (const column of dataset.columns) {
    const value = row[column.key];
    if (value === undefined) throw new TypeError(`Missing export value for ${column.key}`);
    if (column.personalData && value !== null && (typeof value !== 'string' || !/^tok_[A-Za-z0-9_-]{16,128}$/.test(value))) {
      throw new Error(`Clear personal data is forbidden in exports: ${column.key}`);
    }
  }
}

export function canonicalExport(dataset: ExportDataset): string {
  assertExportDatasetSafe(dataset);
  return JSON.stringify({ columns: dataset.columns.map(({ key, label, personalData = false }) => ({ key, label, personalData })), rows: dataset.rows.map(row => Object.fromEntries(dataset.columns.map(column => [column.key, row[column.key]]))) });
}

export function exportChecksum(dataset: ExportDataset): string { return createHash('sha256').update(canonicalExport(dataset)).digest('hex'); }
