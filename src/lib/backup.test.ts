import { describe, expect, it } from 'vitest';

import * as backup from './backup';
import type { CategoryRecord, ExpenseEntry, LedgerBackupFile } from '../types/ledger';

type BuildBackupPayload = (
  entries: ExpenseEntry[],
  categories: CategoryRecord[],
  appVersion: string,
  exportedAt?: string
) => LedgerBackupFile;

const buildBackupPayload = backup.buildBackupPayload as unknown as BuildBackupPayload;
const parseBackupJson = backup.parseBackupJson;
const createBackupFileName = backup.createBackupFileName;
const BACKUP_SCHEMA_VERSION = backup.BACKUP_SCHEMA_VERSION;

const entries: ExpenseEntry[] = [
  {
    id: 'entry-1',
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

describe('backup helpers', () => {
  it('builds a schema-versioned payload with exported timestamp, entries, and categories', () => {
    const payload = buildBackupPayload(entries, categories, '1.0.7', '2026-04-07T12:00:00.000Z');

    expect(payload).toEqual({
      schemaVersion: BACKUP_SCHEMA_VERSION,
      appVersion: '1.0.7',
      exportedAt: '2026-04-07T12:00:00.000Z',
      entries,
      categories,
    });
  });

  it('parses a valid backup json document with category data', () => {
    const parsed = parseBackupJson(
      JSON.stringify({
        schemaVersion: 2,
        appVersion: '1.0.7',
        exportedAt: '2026-04-07T12:00:00.000Z',
        entries,
        categories,
      })
    );

    expect(parsed.entries[0]?.id).toBe('entry-1');
    expect(parsed.categories[0]?.name).toBe('饮食');
    expect(parsed.categories[0]?.subcategories[0]?.name).toBe('食堂');
  });

  it('rejects malformed backup documents', () => {
    expect(() =>
      parseBackupJson(
        JSON.stringify({
          schemaVersion: 2,
          appVersion: '1.0.7',
          exportedAt: '2026-04-07T12:00:00.000Z',
          entries: [{ ...entries[0], monthKey: '2026-13' }],
          categories,
        })
      )
    ).toThrow('备份文件格式不合法');
  });

  it('rejects duplicate entry ids inside the same backup file', () => {
    expect(() =>
      parseBackupJson(
        JSON.stringify({
          schemaVersion: 2,
          appVersion: '1.0.7',
          exportedAt: '2026-04-07T12:00:00.000Z',
          entries: [entries[0], { ...entries[0], note: '重复记录' }],
          categories,
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
