import { isValidMonthInput } from './date';
import type { CategoryRecord, ExpenseEntry, LedgerBackupFile, SubcategoryRecord } from '../types/ledger';

export const BACKUP_SCHEMA_VERSION = 2;

export function buildBackupPayload(
  entries: ExpenseEntry[],
  categories: CategoryRecord[],
  appVersion: string,
  exportedAt = new Date().toISOString()
): LedgerBackupFile {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion,
    exportedAt,
    entries: entries.map((entry) => ({ ...entry })),
    categories: categories.map((category) => ({
      ...category,
      subcategories: category.subcategories.map((subcategory) => ({ ...subcategory })),
    })),
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
    !Array.isArray(candidate.entries) ||
    !Array.isArray(candidate.categories)
  ) {
    throw new Error('备份文件格式不合法');
  }

  const entries = candidate.entries.map(assertExpenseEntry);
  const categories = candidate.categories.map(assertCategoryRecord);
  const entryIds = new Set<string>();
  const categoryIds = new Set<string>();
  const subcategoryIds = new Set<string>();

  for (const entry of entries) {
    if (entryIds.has(entry.id)) {
      throw new Error('备份文件格式不合法');
    }

    entryIds.add(entry.id);
  }

  for (const category of categories) {
    if (categoryIds.has(category.id)) {
      throw new Error('备份文件格式不合法');
    }

    categoryIds.add(category.id);

    for (const subcategory of category.subcategories) {
      if (subcategory.categoryId !== category.id || subcategoryIds.has(subcategory.id)) {
        throw new Error('备份文件格式不合法');
      }

      subcategoryIds.add(subcategory.id);
    }
  }

  return {
    schemaVersion: candidate.schemaVersion,
    appVersion: candidate.appVersion,
    exportedAt: candidate.exportedAt,
    entries,
    categories,
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

function assertCategoryRecord(value: unknown): CategoryRecord {
  if (!value || typeof value !== 'object') {
    throw new Error('备份文件格式不合法');
  }

  const category = value as Record<string, unknown>;

  if (
    typeof category.id !== 'string' ||
    !category.id.trim() ||
    typeof category.name !== 'string' ||
    !category.name.trim() ||
    typeof category.color !== 'string' ||
    !category.color.trim() ||
    typeof category.sortOrder !== 'number' ||
    !Number.isFinite(category.sortOrder) ||
    typeof category.createdAt !== 'string' ||
    Number.isNaN(Date.parse(category.createdAt)) ||
    typeof category.updatedAt !== 'string' ||
    Number.isNaN(Date.parse(category.updatedAt)) ||
    !Array.isArray(category.subcategories)
  ) {
    throw new Error('备份文件格式不合法');
  }

  return {
    id: category.id,
    name: category.name,
    color: category.color,
    sortOrder: category.sortOrder,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    subcategories: category.subcategories.map(assertSubcategoryRecord),
  };
}

function assertSubcategoryRecord(value: unknown): SubcategoryRecord {
  if (!value || typeof value !== 'object') {
    throw new Error('备份文件格式不合法');
  }

  const subcategory = value as Record<string, unknown>;

  if (
    typeof subcategory.id !== 'string' ||
    !subcategory.id.trim() ||
    typeof subcategory.categoryId !== 'string' ||
    !subcategory.categoryId.trim() ||
    typeof subcategory.name !== 'string' ||
    !subcategory.name.trim() ||
    typeof subcategory.sortOrder !== 'number' ||
    !Number.isFinite(subcategory.sortOrder) ||
    typeof subcategory.createdAt !== 'string' ||
    Number.isNaN(Date.parse(subcategory.createdAt)) ||
    typeof subcategory.updatedAt !== 'string' ||
    Number.isNaN(Date.parse(subcategory.updatedAt))
  ) {
    throw new Error('备份文件格式不合法');
  }

  return {
    id: subcategory.id,
    categoryId: subcategory.categoryId,
    name: subcategory.name,
    sortOrder: subcategory.sortOrder,
    createdAt: subcategory.createdAt,
    updatedAt: subcategory.updatedAt,
  };
}
