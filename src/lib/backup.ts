import { isValidMonthInput } from './date';
import type { ExpenseEntry, LedgerBackupFile } from '../types/ledger';

export const BACKUP_SCHEMA_VERSION = 1;

export function buildBackupPayload(
  entries: ExpenseEntry[],
  appVersion: string,
  exportedAt = new Date().toISOString()
): LedgerBackupFile {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion,
    exportedAt,
    entries: entries.map((entry) => ({ ...entry })),
  };
}

export function createBackupFileName(exportedAt: string) {
  const date = new Date(exportedAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `monthly-ledger-backup-${year}-${month}-${day}.json`;
}

export function parseBackupJson(raw: string): LedgerBackupFile {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('备份文件格式不合法');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('备份文件格式不合法');
  }

  const candidate = parsed as Record<string, unknown>;

  if (
    candidate.schemaVersion !== BACKUP_SCHEMA_VERSION ||
    typeof candidate.appVersion !== 'string' ||
    typeof candidate.exportedAt !== 'string' ||
    Number.isNaN(Date.parse(candidate.exportedAt)) ||
    !Array.isArray(candidate.entries)
  ) {
    throw new Error('备份文件格式不合法');
  }

  const entries = candidate.entries.map(assertExpenseEntry);
  const entryIds = new Set<string>();

  for (const entry of entries) {
    if (entryIds.has(entry.id)) {
      throw new Error('备份文件格式不合法');
    }

    entryIds.add(entry.id);
  }

  return {
    schemaVersion: candidate.schemaVersion,
    appVersion: candidate.appVersion,
    exportedAt: candidate.exportedAt,
    entries,
  };
}

function assertExpenseEntry(value: unknown): ExpenseEntry {
  if (!value || typeof value !== 'object') {
    throw new Error('备份文件格式不合法');
  }

  const entry = value as Record<string, unknown>;

  if (
    typeof entry.id !== 'string' ||
    !entry.id.trim() ||
    typeof entry.monthKey !== 'string' ||
    !isValidMonthInput(entry.monthKey) ||
    typeof entry.amount !== 'number' ||
    !Number.isFinite(entry.amount) ||
    entry.amount <= 0 ||
    typeof entry.category !== 'string' ||
    !entry.category.trim() ||
    (entry.subcategory !== null && typeof entry.subcategory !== 'string') ||
    (entry.note !== null && typeof entry.note !== 'string') ||
    typeof entry.createdAt !== 'string' ||
    Number.isNaN(Date.parse(entry.createdAt))
  ) {
    throw new Error('备份文件格式不合法');
  }

  return {
    id: entry.id,
    monthKey: entry.monthKey,
    amount: entry.amount,
    category: entry.category,
    subcategory: (entry.subcategory ?? null) as string | null,
    note: (entry.note ?? null) as string | null,
    createdAt: entry.createdAt,
  };
}
