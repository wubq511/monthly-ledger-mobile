import { describe, expect, it } from 'vitest';

import * as database from './database';
import type { ExpenseDraft, ExpenseEntry, ParsedLedgerBackupFile } from '../types/ledger';

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

interface BudgetSettingRow {
  scope: string;
  monthKey: string;
  amount: number;
  updatedAt: string;
}

interface AppSettingRow {
  key: string;
  value: string;
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
  updateSubcategoryOrder: (db: never, categoryId: string, idsInOrder: string[]) => Promise<void>;
  getBudgetSettings: (db: never) => Promise<{
    defaultBudget: number | null;
    monthlyBudgets: Record<string, number>;
  }>;
  setDefaultBudget: (db: never, amount: number) => Promise<void>;
  setMonthlyBudgetOverride: (db: never, monthKey: string, amount: number) => Promise<void>;
  clearMonthlyBudgetOverride: (db: never, monthKey: string) => Promise<void>;
  replaceBudgetSettings: (
    db: never,
    settings: { defaultBudget: number | null; monthlyBudgets: Record<string, number> }
  ) => Promise<void>;
  getLedgerMode: (db: never) => Promise<'month' | 'day'>;
  setLedgerMode: (db: never, mode: 'month' | 'day') => Promise<void>;
  importBackupMerge: (
    db: never,
    backup: ParsedLedgerBackupFile
  ) => Promise<{
    categoryResult: {
      importedCategoryCount: number;
      importedSubcategoryCount: number;
      skippedCategoryCount: number;
      skippedSubcategoryCount: number;
    };
    expenseResult: { importedCount: number; skippedCount: number };
    budgetSettingsApplied: boolean;
  }>;
  restoreBackupReplace: (
    db: never,
    backup: ParsedLedgerBackupFile
  ) => Promise<{
    expenseResult: { importedCount: number; skippedCount: number };
    budgetSettingsApplied: boolean;
  }>;
}

function requireDatabaseApi<K extends keyof DatabaseApi>(key: K): DatabaseApi[K] {
  expect(key in database).toBe(true);

  return (database as unknown as DatabaseApi)[key];
}

class FakeDatabase {
  rows: ExpenseEntry[];
  categories: CategoryRow[];
  subcategories: SubcategoryRow[];
  budgetSettings: BudgetSettingRow[];
  appSettings: AppSettingRow[];
  execStatements: string[];
  runStatements: Array<{ sql: string; params: unknown[] }>;
  readStatements: string[];
  failOnSqlPrefix: string | null;
  transactionDepth: number;

  constructor(rows: ExpenseEntry[], failOnSqlPrefix: string | null = null) {
    this.rows = [...rows];
    this.categories = [];
    this.subcategories = [];
    this.budgetSettings = [];
    this.appSettings = [];
    this.execStatements = [];
    this.runStatements = [];
    this.readStatements = [];
    this.failOnSqlPrefix = failOnSqlPrefix;
    this.transactionDepth = 0;
  }

  async execAsync(sql: string) {
    this.execStatements.push(sql);
    return;
  }

  async getAllAsync(sql: string) {
    const normalized = normalizeSql(sql);
    this.readStatements.push(sql);

    if (normalized.includes('FROM EXPENSES')) {
      return this.rows
        .slice()
        .sort((left, right) => {
          if (left.dateKey === right.dateKey) {
            return right.createdAt.localeCompare(left.createdAt);
          }

          return right.dateKey.localeCompare(left.dateKey);
        })
        .map((row) => ({
          id: row.id,
          date: row.dateKey,
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

    if (normalized.includes('FROM BUDGET_SETTINGS')) {
      return this.budgetSettings
        .slice()
        .sort((left, right) => left.monthKey.localeCompare(right.monthKey))
        .map((row) => ({
          scope: row.scope,
          month_key: row.monthKey,
          amount: row.amount,
        }));
    }

    if (normalized.includes('FROM APP_SETTINGS')) {
      return this.appSettings
        .slice()
        .sort((left, right) => left.key.localeCompare(right.key))
        .map((row) => ({
          key: row.key,
          value: row.value,
        }));
    }

    return [];
  }

  async runAsync(sql: string, params: unknown[] = []) {
    const normalized = normalizeSql(sql);
    if (this.failOnSqlPrefix && normalized.startsWith(this.failOnSqlPrefix)) {
      throw new Error('simulated failure');
    }

    this.runStatements.push({ sql, params: [...params] });

    if (normalized.startsWith('DELETE FROM EXPENSES WHERE ID = ?')) {
      this.rows = this.rows.filter((row) => row.id !== params[0]);
      return;
    }

    if (normalized === 'DELETE FROM EXPENSES') {
      this.rows = [];
      return;
    }

    if (normalized === 'DELETE FROM BUDGET_SETTINGS') {
      this.budgetSettings = [];
      return;
    }

    if (normalized.startsWith('INSERT INTO EXPENSES')) {
      this.rows.push({
        id: params[0] as string,
        dateKey: params[1] as string,
        monthKey: params[2] as string,
        amount: params[3] as number,
        category: params[4] as string,
        subcategory: (params[5] as string | null) ?? null,
        note: (params[6] as string | null) ?? null,
        createdAt: params[7] as string,
      });
      return;
    }

    if (normalized.startsWith('INSERT INTO APP_SETTINGS')) {
      this.appSettings = this.appSettings.filter((row) => row.key !== params[0]);
      this.appSettings.push({
        key: params[0] as string,
        value: params[1] as string,
        updatedAt: params[2] as string,
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

    if (normalized.startsWith('INSERT INTO BUDGET_SETTINGS')) {
      const scope = normalized.includes("VALUES ('DEFAULT'") ? 'default' : 'month';
      const monthKey = scope === 'default' ? '' : (params[0] as string);
      const amount = scope === 'default' ? (params[0] as number) : (params[1] as number);
      const updatedAt = scope === 'default' ? (params[1] as string) : (params[2] as string);

      this.budgetSettings = this.budgetSettings.filter(
        (row) => !(row.scope === scope && row.monthKey === monthKey)
      );

      this.budgetSettings.push({
        scope,
        monthKey,
        amount,
        updatedAt,
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

    if (normalized.startsWith("DELETE FROM BUDGET_SETTINGS WHERE SCOPE = 'MONTH' AND MONTH_KEY = ?")) {
      this.budgetSettings = this.budgetSettings.filter(
        (row) => !(row.scope === 'month' && row.monthKey === params[0])
      );
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

    if (
      normalized.startsWith(
        'UPDATE SUBCATEGORIES SET SORT_ORDER = ?, UPDATED_AT = ? WHERE ID = ? AND CATEGORY_ID = ?'
      )
    ) {
      this.subcategories = this.subcategories.map((row) =>
        row.id === params[2] && row.categoryId === params[3]
          ? {
              ...row,
              sortOrder: params[0] as number,
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
    if (this.transactionDepth > 0) {
      throw new Error('nested transaction');
    }

    this.transactionDepth += 1;
    const snapshot = {
      rows: this.rows.map((row) => ({ ...row })),
      categories: this.categories.map((row) => ({ ...row })),
      subcategories: this.subcategories.map((row) => ({ ...row })),
      budgetSettings: this.budgetSettings.map((row) => ({ ...row })),
      appSettings: this.appSettings.map((row) => ({ ...row })),
      execStatements: [...this.execStatements],
      runStatements: this.runStatements.map((row) => ({ sql: row.sql, params: [...row.params] })),
      readStatements: [...this.readStatements],
    };

    try {
      return await task();
    } catch (error) {
      this.rows = snapshot.rows;
      this.categories = snapshot.categories;
      this.subcategories = snapshot.subcategories;
      this.budgetSettings = snapshot.budgetSettings;
      this.appSettings = snapshot.appSettings;
      this.execStatements = snapshot.execStatements;
      this.runStatements = snapshot.runStatements;
      this.readStatements = snapshot.readStatements;
      throw error;
    } finally {
      this.transactionDepth -= 1;
    }
  }
}

function normalizeSql(sql: string) {
  return sql.replace(/\s+/g, ' ').trim().toUpperCase();
}

const existing: ExpenseEntry[] = [
  {
    id: 'existing-1',
    dateKey: '2026-04-03',
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
    dateKey: '2026-05-08',
    monthKey: '2026-05',
    amount: 88,
    category: '交通',
    subcategory: null,
    note: '打车',
    createdAt: '2026-05-01T00:00:00.000Z',
  },
];

const importedCategories = [
  {
    id: 'imported-category-1',
    name: '旅行',
    color: '#6B8E23',
    sortOrder: 0,
    createdAt: '2026-04-16T12:00:00.000Z',
    updatedAt: '2026-04-16T12:00:00.000Z',
    subcategories: [
      {
        id: 'imported-subcategory-1',
        categoryId: 'imported-category-1',
        name: '机票',
        sortOrder: 0,
        createdAt: '2026-04-16T12:00:00.000Z',
        updatedAt: '2026-04-16T12:00:00.000Z',
      },
    ],
  },
];

const legacyBackup: ParsedLedgerBackupFile = {
  schemaVersion: 2,
  appVersion: '1.0.8',
  exportedAt: '2026-04-16T12:00:00.000Z',
  entries: [
    {
      id: 'legacy-expense-1',
      dateKey: '2026-04-16',
      monthKey: '2026-04',
      amount: 88,
      category: '旅行',
      subcategory: '机票',
      note: null,
      createdAt: '2026-04-16T12:00:00.000Z',
    },
  ],
  categories: importedCategories,
  budgetSettings: {
    defaultBudget: null,
    monthlyBudgets: {},
  },
  ledgerMode: 'month',
  hasBudgetSettings: false,
  hasLedgerMode: false,
};

const schema3Backup: ParsedLedgerBackupFile = {
  ...legacyBackup,
  schemaVersion: 3,
  budgetSettings: {
    defaultBudget: 3200,
    monthlyBudgets: {
      '2026-04': 3000,
    },
  },
  ledgerMode: 'day',
  hasBudgetSettings: true,
  hasLedgerMode: true,
};

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
      dateKey: '2026-04-11',
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
      dateKey: '2026-04-12',
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
      dateKey: '2026-04-13',
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

  it('persists subcategory order changes for subsequent reads', async () => {
    const db = new FakeDatabase([]);
    const initializeDatabase = requireDatabaseApi('initializeDatabase');
    const getAllCategories = requireDatabaseApi('getAllCategories');
    const updateSubcategoryOrder = requireDatabaseApi('updateSubcategoryOrder');

    await initializeDatabase(db as never);
    const category = (await getAllCategories(db as never)).find(
      (item) => item.subcategories.length >= 3
    );

    expect(category).toBeDefined();
    const reorderedIds = category!.subcategories.slice(0, 3).map((item) => item.id);

    await updateSubcategoryOrder(db as never, category!.id, [
      reorderedIds[2]!,
      reorderedIds[0]!,
      reorderedIds[1]!,
    ]);

    const refreshed = (await getAllCategories(db as never)).find((item) => item.id === category!.id);

    expect(refreshed?.subcategories.slice(0, 3).map((item) => item.id)).toEqual([
      reorderedIds[2],
      reorderedIds[0],
      reorderedIds[1],
    ]);
  });
});

describe('database budget persistence', () => {
  it('includes the budget settings schema in initializeDatabase SQL', async () => {
    const db = new FakeDatabase([]);
    const initializeDatabase = requireDatabaseApi('initializeDatabase');

    await initializeDatabase(db as never);

    const combinedSql = db.execStatements.join('\n');

    expect(combinedSql).toContain('CREATE TABLE IF NOT EXISTS budget_settings');
    expect(combinedSql).toContain('scope TEXT NOT NULL');
    expect(combinedSql).toContain('month_key TEXT NOT NULL DEFAULT');
    expect(combinedSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_settings_scope_month');
    expect(combinedSql).toContain('ON budget_settings(scope, month_key)');
  });

  it('uses conflict-aware upserts for default and monthly budgets', async () => {
    const db = new FakeDatabase([]);
    const setDefaultBudget = requireDatabaseApi('setDefaultBudget');
    const setMonthlyBudgetOverride = requireDatabaseApi('setMonthlyBudgetOverride');

    await setDefaultBudget(db as never, 3200);
    await setMonthlyBudgetOverride(db as never, '2026-04', 2800);

    expect(db.runStatements).toEqual([
      {
        sql: `INSERT INTO budget_settings (scope, month_key, amount, updated_at)
     VALUES ('default', '', ?, ?)
     ON CONFLICT(scope, month_key) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at`,
        params: [3200, expect.any(String)],
      },
      {
        sql: `INSERT INTO budget_settings (scope, month_key, amount, updated_at)
     VALUES ('month', ?, ?, ?)
     ON CONFLICT(scope, month_key) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at`,
        params: ['2026-04', 2800, expect.any(String)],
      },
    ]);
  });

  it('stores and reads the default budget and monthly overrides', async () => {
    const db = new FakeDatabase([]);
    const initializeDatabase = requireDatabaseApi('initializeDatabase');
    const getBudgetSettings = requireDatabaseApi('getBudgetSettings');
    const setDefaultBudget = requireDatabaseApi('setDefaultBudget');
    const setMonthlyBudgetOverride = requireDatabaseApi('setMonthlyBudgetOverride');

    await initializeDatabase(db as never);
    await setDefaultBudget(db as never, 3200);
    await setMonthlyBudgetOverride(db as never, '2026-04', 2800);

    await expect(getBudgetSettings(db as never)).resolves.toEqual({
      defaultBudget: 3200,
      monthlyBudgets: {
        '2026-04': 2800,
      },
    });
  });

  it('overwrites the default budget on repeated calls', async () => {
    const db = new FakeDatabase([]);
    const initializeDatabase = requireDatabaseApi('initializeDatabase');
    const setDefaultBudget = requireDatabaseApi('setDefaultBudget');
    const getBudgetSettings = requireDatabaseApi('getBudgetSettings');

    await initializeDatabase(db as never);
    await setDefaultBudget(db as never, 3200);
    await setDefaultBudget(db as never, 4100);

    await expect(getBudgetSettings(db as never)).resolves.toEqual({
      defaultBudget: 4100,
      monthlyBudgets: {},
    });
  });

  it('overwrites a monthly override on repeated calls', async () => {
    const db = new FakeDatabase([]);
    const initializeDatabase = requireDatabaseApi('initializeDatabase');
    const setMonthlyBudgetOverride = requireDatabaseApi('setMonthlyBudgetOverride');
    const getBudgetSettings = requireDatabaseApi('getBudgetSettings');

    await initializeDatabase(db as never);
    await setMonthlyBudgetOverride(db as never, '2026-04', 2800);
    await setMonthlyBudgetOverride(db as never, '2026-04', 2950);

    await expect(getBudgetSettings(db as never)).resolves.toEqual({
      defaultBudget: null,
      monthlyBudgets: {
        '2026-04': 2950,
      },
    });
  });

  it('removes a monthly override without touching the default budget', async () => {
    const db = new FakeDatabase([]);
    const initializeDatabase = requireDatabaseApi('initializeDatabase');
    const setDefaultBudget = requireDatabaseApi('setDefaultBudget');
    const setMonthlyBudgetOverride = requireDatabaseApi('setMonthlyBudgetOverride');
    const clearMonthlyBudgetOverride = requireDatabaseApi('clearMonthlyBudgetOverride');
    const getBudgetSettings = requireDatabaseApi('getBudgetSettings');

    await initializeDatabase(db as never);
    await setDefaultBudget(db as never, 2600);
    await setMonthlyBudgetOverride(db as never, '2026-05', 3000);
    await clearMonthlyBudgetOverride(db as never, '2026-05');

    await expect(getBudgetSettings(db as never)).resolves.toEqual({
      defaultBudget: 2600,
      monthlyBudgets: {},
    });
  });

  it('replaces all budget settings through a single restore path', async () => {
    const db = new FakeDatabase([]);
    const initializeDatabase = requireDatabaseApi('initializeDatabase');
    const setDefaultBudget = requireDatabaseApi('setDefaultBudget');
    const setMonthlyBudgetOverride = requireDatabaseApi('setMonthlyBudgetOverride');
    const replaceBudgetSettings = requireDatabaseApi('replaceBudgetSettings');
    const getBudgetSettings = requireDatabaseApi('getBudgetSettings');

    await initializeDatabase(db as never);
    await setDefaultBudget(db as never, 2600);
    await setMonthlyBudgetOverride(db as never, '2026-03', 2400);

    await replaceBudgetSettings(db as never, {
      defaultBudget: 3200,
      monthlyBudgets: {
        '2026-04': 3000,
      },
    });

    await expect(getBudgetSettings(db as never)).resolves.toEqual({
      defaultBudget: 3200,
      monthlyBudgets: {
        '2026-04': 3000,
      },
    });
  });

  it('preserves existing budgets when importing a legacy backup', async () => {
    const db = new FakeDatabase([]);
    const initializeDatabase = requireDatabaseApi('initializeDatabase');
    const setDefaultBudget = requireDatabaseApi('setDefaultBudget');
    const setMonthlyBudgetOverride = requireDatabaseApi('setMonthlyBudgetOverride');
    const importBackupMerge = requireDatabaseApi('importBackupMerge');
    const getBudgetSettings = requireDatabaseApi('getBudgetSettings');

    await initializeDatabase(db as never);
    await setDefaultBudget(db as never, 2600);
    await setMonthlyBudgetOverride(db as never, '2026-03', 2400);

    await expect(importBackupMerge(db as never, legacyBackup)).resolves.toEqual({
      categoryResult: {
        importedCategoryCount: 1,
        importedSubcategoryCount: 1,
        skippedCategoryCount: 0,
        skippedSubcategoryCount: 0,
      },
      expenseResult: {
        importedCount: 1,
        skippedCount: 0,
      },
      budgetSettingsApplied: false,
    });

    await expect(getBudgetSettings(db as never)).resolves.toEqual({
      defaultBudget: 2600,
      monthlyBudgets: {
        '2026-03': 2400,
      },
    });
  });

  it('applies schema 3 budgets when importing a backup', async () => {
    const db = new FakeDatabase([]);
    const initializeDatabase = requireDatabaseApi('initializeDatabase');
    const setDefaultBudget = requireDatabaseApi('setDefaultBudget');
    const setMonthlyBudgetOverride = requireDatabaseApi('setMonthlyBudgetOverride');
    const importBackupMerge = requireDatabaseApi('importBackupMerge');
    const getBudgetSettings = requireDatabaseApi('getBudgetSettings');

    await initializeDatabase(db as never);
    await setDefaultBudget(db as never, 2600);
    await setMonthlyBudgetOverride(db as never, '2026-03', 2400);

    await expect(importBackupMerge(db as never, schema3Backup)).resolves.toEqual({
      categoryResult: {
        importedCategoryCount: 1,
        importedSubcategoryCount: 1,
        skippedCategoryCount: 0,
        skippedSubcategoryCount: 0,
      },
      expenseResult: {
        importedCount: 1,
        skippedCount: 0,
      },
      budgetSettingsApplied: true,
    });

    await expect(getBudgetSettings(db as never)).resolves.toEqual({
      defaultBudget: 3200,
      monthlyBudgets: {
        '2026-04': 3000,
      },
    });
  });

  it('rolls back a combined import if category insertion fails', async () => {
    const db = new FakeDatabase([]);
    const initializeDatabase = requireDatabaseApi('initializeDatabase');
    const setDefaultBudget = requireDatabaseApi('setDefaultBudget');
    const setMonthlyBudgetOverride = requireDatabaseApi('setMonthlyBudgetOverride');
    const importBackupMerge = requireDatabaseApi('importBackupMerge');
    const getBudgetSettings = requireDatabaseApi('getBudgetSettings');
    const getAllCategories = requireDatabaseApi('getAllCategories');
    const getAllExpenses = requireDatabaseApi('getAllExpenses');

    await initializeDatabase(db as never);
    await setDefaultBudget(db as never, 2600);
    await setMonthlyBudgetOverride(db as never, '2026-03', 2400);
    db.failOnSqlPrefix = 'INSERT INTO SUBCATEGORIES';

    await expect(importBackupMerge(db as never, schema3Backup)).rejects.toThrow('simulated failure');

    await expect(getBudgetSettings(db as never)).resolves.toEqual({
      defaultBudget: 2600,
      monthlyBudgets: {
        '2026-03': 2400,
      },
    });

    const categories = await getAllCategories(db as never);
    const expenses = await getAllExpenses(db as never);

    expect(categories.some((category) => category.name === '旅行')).toBe(false);
    expect(expenses).toHaveLength(0);
  });

  it('preserves existing budgets when restoring a legacy backup', async () => {
    const db = new FakeDatabase([]);
    const initializeDatabase = requireDatabaseApi('initializeDatabase');
    const setDefaultBudget = requireDatabaseApi('setDefaultBudget');
    const setMonthlyBudgetOverride = requireDatabaseApi('setMonthlyBudgetOverride');
    const restoreBackupReplace = requireDatabaseApi('restoreBackupReplace');
    const getBudgetSettings = requireDatabaseApi('getBudgetSettings');

    await initializeDatabase(db as never);
    await setDefaultBudget(db as never, 2600);
    await setMonthlyBudgetOverride(db as never, '2026-03', 2400);

    await expect(restoreBackupReplace(db as never, legacyBackup)).resolves.toEqual({
      expenseResult: {
        importedCount: 1,
        skippedCount: 0,
      },
      budgetSettingsApplied: false,
    });

    await expect(getBudgetSettings(db as never)).resolves.toEqual({
      defaultBudget: 2600,
      monthlyBudgets: {
        '2026-03': 2400,
      },
    });
  });

  it('applies schema 3 budgets when restoring a backup', async () => {
    const db = new FakeDatabase([]);
    const initializeDatabase = requireDatabaseApi('initializeDatabase');
    const setDefaultBudget = requireDatabaseApi('setDefaultBudget');
    const setMonthlyBudgetOverride = requireDatabaseApi('setMonthlyBudgetOverride');
    const restoreBackupReplace = requireDatabaseApi('restoreBackupReplace');
    const getBudgetSettings = requireDatabaseApi('getBudgetSettings');

    await initializeDatabase(db as never);
    await setDefaultBudget(db as never, 2600);
    await setMonthlyBudgetOverride(db as never, '2026-03', 2400);

    await expect(restoreBackupReplace(db as never, schema3Backup)).resolves.toEqual({
      expenseResult: {
        importedCount: 1,
        skippedCount: 0,
      },
      budgetSettingsApplied: true,
    });

    await expect(getBudgetSettings(db as never)).resolves.toEqual({
      defaultBudget: 3200,
      monthlyBudgets: {
        '2026-04': 3000,
      },
    });
  });

  it('rolls back a combined restore if the final budget step fails', async () => {
    const db = new FakeDatabase([]);
    const initializeDatabase = requireDatabaseApi('initializeDatabase');
    const setDefaultBudget = requireDatabaseApi('setDefaultBudget');
    const setMonthlyBudgetOverride = requireDatabaseApi('setMonthlyBudgetOverride');
    const restoreBackupReplace = requireDatabaseApi('restoreBackupReplace');
    const getBudgetSettings = requireDatabaseApi('getBudgetSettings');
    const getAllCategories = requireDatabaseApi('getAllCategories');
    const getAllExpenses = requireDatabaseApi('getAllExpenses');

    await initializeDatabase(db as never);
    await setDefaultBudget(db as never, 2600);
    await setMonthlyBudgetOverride(db as never, '2026-03', 2400);
    db.failOnSqlPrefix = 'INSERT INTO BUDGET_SETTINGS';

    await expect(restoreBackupReplace(db as never, schema3Backup)).rejects.toThrow('simulated failure');

    await expect(getBudgetSettings(db as never)).resolves.toEqual({
      defaultBudget: 2600,
      monthlyBudgets: {
        '2026-03': 2400,
      },
    });

    const categories = await getAllCategories(db as never);
    const expenses = await getAllExpenses(db as never);

    expect(categories.length).toBeGreaterThan(0);
    expect(expenses).toHaveLength(0);
  });
});

describe('database app settings', () => {
  it('includes the app settings schema for ledger mode persistence', async () => {
    const db = new FakeDatabase([]);
    const initializeDatabase = requireDatabaseApi('initializeDatabase');

    await initializeDatabase(db as never);

    const combinedSql = db.execStatements.join('\n');

    expect(combinedSql).toContain('CREATE TABLE IF NOT EXISTS app_settings');
    expect(combinedSql).toContain('key TEXT PRIMARY KEY NOT NULL');
    expect(combinedSql).toContain('value TEXT NOT NULL');
  });

  it('stores and reads the ledger mode setting', async () => {
    const db = new FakeDatabase([]);
    const initializeDatabase = requireDatabaseApi('initializeDatabase');
    const getLedgerMode = requireDatabaseApi('getLedgerMode');
    const setLedgerMode = requireDatabaseApi('setLedgerMode');

    await initializeDatabase(db as never);
    await expect(getLedgerMode(db as never)).resolves.toBe('month');

    await setLedgerMode(db as never, 'day');

    await expect(getLedgerMode(db as never)).resolves.toBe('day');
  });
});

describe('database expense dates', () => {
  it('stores the draft date key instead of forcing the first day of the month', async () => {
    const db = new FakeDatabase([]);
    const insertExpense = requireDatabaseApi('insertExpense');
    const getAllExpenses = requireDatabaseApi('getAllExpenses');

    await insertExpense(db as never, {
      dateKey: '2026-04-17',
      monthKey: '2026-04',
      amount: 20,
      category: '饮食',
      subcategory: '食堂',
      note: '午饭',
    });

    const expenses = await getAllExpenses(db as never);

    expect(expenses[0]?.dateKey).toBe('2026-04-17');
  });

  it('reads expenses using date ordering', async () => {
    const db = new FakeDatabase(existing);
    const getAllExpenses = requireDatabaseApi('getAllExpenses');

    await getAllExpenses(db as never);

    expect(
      db.readStatements.some((sql) =>
        normalizeSql(sql).includes('ORDER BY DATE DESC, CREATED_AT DESC')
      )
    ).toBe(true);
  });
});
