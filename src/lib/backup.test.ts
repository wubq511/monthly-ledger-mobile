import { describe, expect, it } from 'vitest';

import * as backup from './backup';
import type {
  BudgetSettings,
  CategoryRecord,
  ExpenseEntry,
  LedgerBackupFile,
  ParsedLedgerBackupFile,
} from '../types/ledger';

type BuildBackupPayload = (
  entries: ExpenseEntry[],
  categories: CategoryRecord[],
  budgetSettings: BudgetSettings,
  appVersion: string,
  exportedAt?: string,
  ledgerMode?: 'month' | 'day'
) => LedgerBackupFile;

const buildBackupPayload = backup.buildBackupPayload as unknown as BuildBackupPayload;
const parseBackupJson = backup.parseBackupJson as unknown as (raw: string) => ParsedLedgerBackupFile;
const createBackupFileName = backup.createBackupFileName;
const BACKUP_SCHEMA_VERSION = backup.BACKUP_SCHEMA_VERSION;

const entries: ExpenseEntry[] = [
  {
    id: 'entry-1',
    dateKey: '2026-04-07',
    monthKey: '2026-04',
    amount: 25.5,
    category: '饮食',
    subcategory: '食堂',
    note: '午饭',
    createdAt: '2026-04-07T12:00:00.000Z',
  },
];

const categories: CategoryRecord[] = [
  {
    id: 'category-1',
    name: '饮食',
    color: '#C76439',
    sortOrder: 0,
    createdAt: '2026-04-07T12:00:00.000Z',
    updatedAt: '2026-04-07T12:00:00.000Z',
    subcategories: [
      {
        id: 'subcategory-1',
        categoryId: 'category-1',
        name: '食堂',
        sortOrder: 0,
        createdAt: '2026-04-07T12:00:00.000Z',
        updatedAt: '2026-04-07T12:00:00.000Z',
      },
    ],
  },
  {
    id: 'category-2',
    name: '交通',
    color: '#3A6D9A',
    sortOrder: 1,
    createdAt: '2026-04-07T12:00:00.000Z',
    updatedAt: '2026-04-07T12:00:00.000Z',
    subcategories: [],
  },
];

const budgetSettings: BudgetSettings = {
  defaultBudget: 2600,
  monthlyBudgets: {
    '2026-04': 3000,
  },
};

describe('backup helpers', () => {
  it('builds a schema-versioned payload with exported timestamp, entries, and categories', () => {
    const payload = buildBackupPayload(
      entries,
      categories,
      budgetSettings,
      '1.0.8',
      '2026-04-07T12:00:00.000Z',
      'day'
    );

    expect(payload).toEqual({
      schemaVersion: BACKUP_SCHEMA_VERSION,
      appVersion: '1.0.8',
      exportedAt: '2026-04-07T12:00:00.000Z',
      entries,
      categories,
      budgetSettings,
      ledgerMode: 'day',
    });
  });

  it('builds a payload that includes default and monthly budget settings', () => {
    const payload = buildBackupPayload(
      entries,
      categories,
      {
        defaultBudget: 2600,
        monthlyBudgets: { '2026-04': 3000 },
      },
      '1.0.8',
      '2026-04-16T12:00:00.000Z',
      'day'
    );

    expect(payload.budgetSettings).toEqual({
      defaultBudget: 2600,
      monthlyBudgets: { '2026-04': 3000 },
    });
  });

  it('parses a valid backup json document with category data', () => {
    const parsed = parseBackupJson(
      JSON.stringify({
        schemaVersion: 3,
        appVersion: '1.0.8',
        exportedAt: '2026-04-07T12:00:00.000Z',
        entries,
        categories,
        budgetSettings,
        ledgerMode: 'day',
      })
    );

    expect(parsed.entries[0]?.id).toBe('entry-1');
    expect(parsed.categories[0]?.name).toBe('饮食');
    expect(parsed.categories[0]?.subcategories[0]?.name).toBe('食堂');
    expect(parsed.budgetSettings).toEqual(budgetSettings);
    expect(parsed.hasBudgetSettings).toBe(true);
    expect(parsed.ledgerMode).toBe('day');
  });

  it('accepts legacy backup files without budget settings and falls back to empty config', () => {
    const parsed = parseBackupJson(
      JSON.stringify({
        schemaVersion: 2,
        appVersion: '1.0.8',
        exportedAt: '2026-04-16T12:00:00.000Z',
        entries,
        categories,
      })
    );

    expect(parsed.budgetSettings).toEqual({
      defaultBudget: null,
      monthlyBudgets: {},
    });
    expect(parsed.hasBudgetSettings).toBe(false);
    expect(parsed.ledgerMode).toBe('month');
  });

  it('rejects malformed backup documents', () => {
    expect(() =>
      parseBackupJson(
        JSON.stringify({
          schemaVersion: 3,
          appVersion: '1.0.8',
          exportedAt: '2026-04-07T12:00:00.000Z',
          entries: [{ ...entries[0], monthKey: '2026-13' }],
          categories,
          budgetSettings,
        })
      )
    ).toThrow('备份文件格式不合法');
  });

  it('rejects duplicate entry ids inside the same backup file', () => {
    expect(() =>
      parseBackupJson(
        JSON.stringify({
          schemaVersion: 3,
          appVersion: '1.0.8',
          exportedAt: '2026-04-07T12:00:00.000Z',
          entries: [entries[0], { ...entries[0], note: '重复记录' }],
          categories,
          budgetSettings,
        })
      )
    ).toThrow('备份文件格式不合法');
  });

  it('generates a date-based file name', () => {
    expect(createBackupFileName('2026-04-07T12:00:00.000Z')).toBe(
      'monthly-ledger-backup-2026-04-07.json'
    );
  });
});
