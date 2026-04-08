import { describe, expect, it } from 'vitest';

import * as database from './database';
import type { ExpenseDraft, ExpenseEntry } from '../types/ledger';

interface CategoryRow {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface SubcategoryRow {
  id: string;
  categoryId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface CategoryRecordLike {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  subcategories: Array<{
    id: string;
    categoryId: string;
    name: string;
    sortOrder: number;
  }>;
}

interface DatabaseApi {
  initializeDatabase: (db: never) => Promise<void>;
  exportAllExpenses: (db: never) => Promise<ExpenseEntry[]>;
  importExpensesMerge: (db: never, entries: ExpenseEntry[]) => Promise<{ importedCount: number; skippedCount: number }>;
  replaceAllExpenses: (db: never, entries: ExpenseEntry[]) => Promise<{ importedCount: number; skippedCount: number }>;
  clearAllExpenses: (db: never) => Promise<void>;
  insertExpense: (db: never, draft: ExpenseDraft) => Promise<void>;
  getAllExpenses: (db: never) => Promise<ExpenseEntry[]>;
  getAllCategories: (db: never) => Promise<CategoryRecordLike[]>;
  renameCategory: (db: never, id: string, name: string) => Promise<void>;
  deleteCategory: (db: never, id: string) => Promise<void>;
  renameSubcategory: (db: never, id: string, name: string) => Promise<void>;
  updateCategoryOrder: (db: never, idsInOrder: string[]) => Promise<void>;
}

function requireDatabaseApi<K extends keyof DatabaseApi>(key: K): DatabaseApi[K] {
  expect(key in database).toBe(true);

  return (database as unknown as DatabaseApi)[key];
}

class FakeDatabase {
  rows: ExpenseEntry[];
  categories: CategoryRow[];
  subcategories: SubcategoryRow[];

  constructor(rows: ExpenseEntry[]) {
    this.rows = [...rows];
    this.categories = [];
    this.subcategories = [];
  }

  async execAsync() {
    return;
  }

  async getAllAsync(sql: string) {
    const normalized = normalizeSql(sql);

    if (normalized.includes('FROM EXPENSES')) {
      return this.rows
        .slice()
        .sort((left, right) => {
          if (left.monthKey === right.monthKey) {
            return right.createdAt.localeCompare(left.createdAt);
          }

          return right.monthKey.localeCompare(left.monthKey);
        })
        .map((row) => ({
          id: row.id,
          month_key: row.monthKey,
          amount: row.amount,
          category: row.category,
          subcategory: row.subcategory,
          note: row.note,
          created_at: row.createdAt,
        }));
    }

    if (normalized.includes('FROM CATEGORIES')) {
      return this.categories
        .slice()
        .sort((left, right) => left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt))
        .map((row) => ({
          id: row.id,
          name: row.name,
          color: row.color,
          sort_order: row.sortOrder,
          created_at: row.createdAt,
          updated_at: row.updatedAt,
        }));
    }

    if (normalized.includes('FROM SUBCATEGORIES')) {
      return this.subcategories
        .slice()
        .sort((left, right) => left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt))
        .map((row) => ({
          id: row.id,
          category_id: row.categoryId,
          name: row.name,
          sort_order: row.sortOrder,
          created_at: row.createdAt,
          updated_at: row.updatedAt,
        }));
    }

    return [];
  }

  async runAsync(sql: string, params: unknown[] = []) {
    const normalized = normalizeSql(sql);

    if (normalized.startsWith('DELETE FROM EXPENSES WHERE ID = ?')) {
      this.rows = this.rows.filter((row) => row.id !== params[0]);
      return;
    }

    if (normalized === 'DELETE FROM EXPENSES') {
      this.rows = [];
      return;
    }

    if (normalized.startsWith('INSERT INTO EXPENSES')) {
      this.rows.push({
        id: params[0] as string,
        monthKey: params[2] as string,
        amount: params[3] as number,
        category: params[4] as string,
        subcategory: (params[5] as string | null) ?? null,
        note: (params[6] as string | null) ?? null,
        createdAt: params[7] as string,
      });
      return;
    }

    if (normalized.startsWith('INSERT INTO CATEGORIES')) {
      this.categories.push({
        id: params[0] as string,
        name: params[1] as string,
        color: params[2] as string,
        sortOrder: params[3] as number,
        createdAt: params[4] as string,
        updatedAt: params[5] as string,
      });
      return;
    }

    if (normalized.startsWith('INSERT INTO SUBCATEGORIES')) {
      this.subcategories.push({
        id: params[0] as string,
        categoryId: params[1] as string,
        name: params[2] as string,
        sortOrder: params[3] as number,
        createdAt: params[4] as string,
        updatedAt: params[5] as string,
      });
      return;
    }

    if (normalized.startsWith('UPDATE CATEGORIES SET NAME = ?, UPDATED_AT = ? WHERE ID = ?')) {
      this.categories = this.categories.map((row) =>
        row.id === params[2]
          ? {
              ...row,
              name: params[0] as string,
              updatedAt: params[1] as string,
            }
          : row
      );
      return;
    }

    if (normalized.startsWith('UPDATE CATEGORIES SET SORT_ORDER = ?, UPDATED_AT = ? WHERE ID = ?')) {
      this.categories = this.categories.map((row) =>
        row.id === params[2]
          ? {
              ...row,
              sortOrder: params[0] as number,
              updatedAt: params[1] as string,
            }
          : row
      );
      return;
    }

    if (normalized.startsWith('UPDATE EXPENSES SET CATEGORY = ? WHERE CATEGORY = ?')) {
      this.rows = this.rows.map((row) =>
        row.category === params[1]
          ? {
              ...row,
              category: params[0] as string,
            }
          : row
      );
      return;
    }

    if (normalized.startsWith('DELETE FROM SUBCATEGORIES WHERE CATEGORY_ID = ?')) {
      this.subcategories = this.subcategories.filter((row) => row.categoryId !== params[0]);
      return;
    }

    if (normalized.startsWith('UPDATE SUBCATEGORIES SET NAME = ?, UPDATED_AT = ? WHERE ID = ?')) {
      this.subcategories = this.subcategories.map((row) =>
        row.id === params[2]
          ? {
              ...row,
              name: params[0] as string,
              updatedAt: params[1] as string,
            }
          : row
      );
      return;
    }

    if (normalized.startsWith('UPDATE EXPENSES SET SUBCATEGORY = ? WHERE CATEGORY = ? AND SUBCATEGORY = ?')) {
      this.rows = this.rows.map((row) =>
        row.category === params[1] && row.subcategory === params[2]
          ? {
              ...row,
              subcategory: (params[0] as string | null) ?? null,
            }
          : row
      );
      return;
    }

    if (normalized.startsWith('DELETE FROM CATEGORIES WHERE ID = ?')) {
      this.categories = this.categories.filter((row) => row.id !== params[0]);
    }
  }

  async withTransactionAsync<T>(task: () => Promise<T>) {
    return task();
  }
}

function normalizeSql(sql: string) {
  return sql.replace(/\s+/g, ' ').trim().toUpperCase();
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
    const exportAllExpenses = requireDatabaseApi('exportAllExpenses');

    await expect(exportAllExpenses(db as never)).resolves.toEqual(existing);
  });

  it('merges only non-duplicate ids', async () => {
    const db = new FakeDatabase(existing);
    const importExpensesMerge = requireDatabaseApi('importExpensesMerge');

    await expect(importExpensesMerge(db as never, incoming)).resolves.toEqual({
      importedCount: 1,
      skippedCount: 1,
    });

    expect(db.rows.map((row) => row.id)).toEqual(['existing-1', 'incoming-2']);
  });

  it('replaces all current rows before restoring incoming data', async () => {
    const db = new FakeDatabase(existing);
    const replaceAllExpenses = requireDatabaseApi('replaceAllExpenses');

    await expect(replaceAllExpenses(db as never, incoming)).resolves.toEqual({
      importedCount: 2,
      skippedCount: 0,
    });

    expect(db.rows.map((row) => row.id)).toEqual(['existing-1', 'incoming-2']);
  });

  it('clears all expenses', async () => {
    const db = new FakeDatabase(existing);
    const clearAllExpenses = requireDatabaseApi('clearAllExpenses');

    await clearAllExpenses(db as never);

    expect(db.rows).toEqual([]);
  });
});

describe('database category persistence', () => {
  it('seeds default categories on first init', async () => {
    const db = new FakeDatabase([]);
    const initializeDatabase = requireDatabaseApi('initializeDatabase');
    const getAllCategories = requireDatabaseApi('getAllCategories');

    await initializeDatabase(db as never);
    const categories = await getAllCategories(db as never);

    expect(categories.length).toBeGreaterThan(0);
    expect(categories[0]?.name).toBe('饮食');
    expect(categories[0]?.subcategories.map((item) => item.name)).toEqual([
      '食堂',
      '外卖',
      '下馆子',
      '零食 / 水果 / 面包',
    ]);
  });

  it('renames a category and updates historical expense rows', async () => {
    const db = new FakeDatabase([]);
    const initializeDatabase = requireDatabaseApi('initializeDatabase');
    const getAllCategories = requireDatabaseApi('getAllCategories');
    const insertExpense = requireDatabaseApi('insertExpense');
    const renameCategory = requireDatabaseApi('renameCategory');
    const getAllExpenses = requireDatabaseApi('getAllExpenses');

    await initializeDatabase(db as never);
    const [category] = await getAllCategories(db as never);

    expect(category).toBeDefined();
    await insertExpense(db as never, {
      monthKey: '2026-04',
      amount: 20,
      category: category!.name,
      subcategory: null,
      note: null,
    });

    await renameCategory(db as never, category!.id, '三餐');
    const expenses = await getAllExpenses(db as never);
    const categories = await getAllCategories(db as never);

    expect(expenses[0]?.category).toBe('三餐');
    expect(categories[0]?.name).toBe('三餐');
  });

  it('deletes a category without deleting historical expense rows', async () => {
    const db = new FakeDatabase([]);
    const initializeDatabase = requireDatabaseApi('initializeDatabase');
    const getAllCategories = requireDatabaseApi('getAllCategories');
    const insertExpense = requireDatabaseApi('insertExpense');
    const deleteCategory = requireDatabaseApi('deleteCategory');
    const getAllExpenses = requireDatabaseApi('getAllExpenses');

    await initializeDatabase(db as never);
    const [category] = await getAllCategories(db as never);

    expect(category).toBeDefined();
    await insertExpense(db as never, {
      monthKey: '2026-04',
      amount: 20,
      category: category!.name,
      subcategory: null,
      note: null,
    });

    await deleteCategory(db as never, category!.id);

    const expenses = await getAllExpenses(db as never);
    const categories = await getAllCategories(db as never);

    expect(expenses).toHaveLength(1);
    expect(expenses[0]?.category).toBe(category!.name);
    expect(categories.find((item) => item.id === category!.id)).toBeUndefined();
  });

  it('renames a subcategory and updates historical expense rows', async () => {
    const db = new FakeDatabase([]);
    const initializeDatabase = requireDatabaseApi('initializeDatabase');
    const getAllCategories = requireDatabaseApi('getAllCategories');
    const insertExpense = requireDatabaseApi('insertExpense');
    const renameSubcategory = requireDatabaseApi('renameSubcategory');
    const getAllExpenses = requireDatabaseApi('getAllExpenses');

    await initializeDatabase(db as never);
    const category = (await getAllCategories(db as never)).find((item) => item.subcategories.length > 0);

    expect(category).toBeDefined();
    const subcategory = category?.subcategories[0];
    expect(subcategory).toBeDefined();

    await insertExpense(db as never, {
      monthKey: '2026-04',
      amount: 18,
      category: category!.name,
      subcategory: subcategory!.name,
      note: null,
    });

    await renameSubcategory(db as never, subcategory!.id, '夜宵');
    const expenses = await getAllExpenses(db as never);
    const categories = await getAllCategories(db as never);

    expect(expenses[0]?.subcategory).toBe('夜宵');
    expect(categories[0]?.subcategories[0]?.name).toBe('夜宵');
  });

  it('persists category order changes for subsequent reads', async () => {
    const db = new FakeDatabase([]);
    const initializeDatabase = requireDatabaseApi('initializeDatabase');
    const getAllCategories = requireDatabaseApi('getAllCategories');
    const updateCategoryOrder = requireDatabaseApi('updateCategoryOrder');

    await initializeDatabase(db as never);
    const categories = await getAllCategories(db as never);
    const reorderedIds = categories.slice(0, 3).map((item) => item.id);

    expect(reorderedIds).toHaveLength(3);

    await updateCategoryOrder(db as never, [reorderedIds[2]!, reorderedIds[0]!, reorderedIds[1]!]);

    const reordered = await getAllCategories(db as never);

    expect(reordered.slice(0, 3).map((item) => item.id)).toEqual([
      reorderedIds[2],
      reorderedIds[0],
      reorderedIds[1],
    ]);
  });
});
