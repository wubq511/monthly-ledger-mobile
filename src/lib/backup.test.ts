import { describe, expect, it } from 'vitest';

import {
  BACKUP_SCHEMA_VERSION,
  buildBackupPayload,
  createBackupFileName,
  parseBackupJson,
} from './backup';
import type { ExpenseEntry } from '../types/ledger';

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

describe('backup helpers', () => {
  it('builds a schema-versioned payload with exported timestamp and entries', () => {
    const payload = buildBackupPayload(entries, '1.0.3', '2026-04-07T12:00:00.000Z');

    expect(payload).toEqual({
      schemaVersion: BACKUP_SCHEMA_VERSION,
      appVersion: '1.0.3',
      exportedAt: '2026-04-07T12:00:00.000Z',
      entries,
    });
  });

  it('parses a valid backup json document', () => {
    const parsed = parseBackupJson(
      JSON.stringify({
        schemaVersion: 1,
        appVersion: '1.0.3',
        exportedAt: '2026-04-07T12:00:00.000Z',
        entries,
      })
    );

    expect(parsed.entries[0].id).toBe('entry-1');
    expect(parsed.entries[0].monthKey).toBe('2026-04');
  });

  it('rejects malformed backup documents', () => {
    expect(() =>
      parseBackupJson(
        JSON.stringify({
          schemaVersion: 1,
          appVersion: '1.0.3',
          exportedAt: '2026-04-07T12:00:00.000Z',
          entries: [{ ...entries[0], monthKey: '2026-13' }],
        })
      )
    ).toThrow('备份文件格式不合法');
  });

  it('rejects duplicate entry ids inside the same backup file', () => {
    expect(() =>
      parseBackupJson(
        JSON.stringify({
          schemaVersion: 1,
          appVersion: '1.0.3',
          exportedAt: '2026-04-07T12:00:00.000Z',
          entries: [entries[0], { ...entries[0], note: '重复记录' }],
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
