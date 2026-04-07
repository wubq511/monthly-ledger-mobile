import { describe, expect, it } from 'vitest';

import {
  clearAllExpenses,
  exportAllExpenses,
  importExpensesMerge,
  replaceAllExpenses,
} from './database';
import type { ExpenseEntry } from '../types/ledger';

class FakeDatabase {
  rows: ExpenseEntry[];

  constructor(rows: ExpenseEntry[]) {
    this.rows = [...rows];
  }

  async getAllAsync() {
    return this.rows.map((row) => ({
      id: row.id,
      month_key: row.monthKey,
      amount: row.amount,
      category: row.category,
      subcategory: row.subcategory,
      note: row.note,
      created_at: row.createdAt,
    }));
  }

  async runAsync(sql: string, params: unknown[] = []) {
    if (sql.startsWith('DELETE FROM expenses WHERE id = ?')) {
      this.rows = this.rows.filter((row) => row.id !== params[0]);
      return;
    }

    if (sql.startsWith('DELETE FROM expenses')) {
      this.rows = [];
      return;
    }

    if (sql.startsWith('INSERT INTO expenses')) {
      this.rows.push({
        id: params[0] as string,
        monthKey: params[2] as string,
        amount: params[3] as number,
        category: params[4] as string,
        subcategory: (params[5] as string | null) ?? null,
        note: (params[6] as string | null) ?? null,
        createdAt: params[7] as string,
      });
    }
  }

  async withTransactionAsync<T>(task: () => Promise<T>) {
    return task();
  }
}

const existing: ExpenseEntry[] = [
  {
    id: 'existing-1',
    monthKey: '2026-04',
    amount: 66,
    category: '饮食',
    subcategory: '食堂',
    note: null,
    createdAt: '2026-04-01T00:00:00.000Z',
  },
];

const incoming: ExpenseEntry[] = [
  existing[0],
  {
    id: 'incoming-2',
    monthKey: '2026-05',
    amount: 88,
    category: '交通',
    subcategory: null,
    note: '打车',
    createdAt: '2026-05-01T00:00:00.000Z',
  },
];

describe('database backup operations', () => {
  it('exports all expenses as ledger entries', async () => {
    const db = new FakeDatabase(existing);

    await expect(exportAllExpenses(db as never)).resolves.toEqual(existing);
  });

  it('merges only non-duplicate ids', async () => {
    const db = new FakeDatabase(existing);

    await expect(importExpensesMerge(db as never, incoming)).resolves.toEqual({
      importedCount: 1,
      skippedCount: 1,
    });

    expect(db.rows.map((row) => row.id)).toEqual(['existing-1', 'incoming-2']);
  });

  it('replaces all current rows before restoring incoming data', async () => {
    const db = new FakeDatabase(existing);

    await expect(replaceAllExpenses(db as never, incoming)).resolves.toEqual({
      importedCount: 2,
      skippedCount: 0,
    });

    expect(db.rows.map((row) => row.id)).toEqual(['existing-1', 'incoming-2']);
  });

  it('clears all expenses', async () => {
    const db = new FakeDatabase(existing);

    await clearAllExpenses(db as never);

    expect(db.rows).toEqual([]);
  });
});
