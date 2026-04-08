import type { SQLiteDatabase } from 'expo-sqlite';

import { CATEGORY_DEFINITIONS, getSeedColorByIndex } from '../constants/categories';
import type {
  CategoryRecord,
  CategoryUsageSummary,
  CreateCategoryInput,
  ExpenseDraft,
  ExpenseEntry,
  ImportExpensesResult,
  SubcategoryUsageSummary,
  SubcategoryRecord,
} from '../types/ledger';

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface ExpenseRow {
  id: string;
  month_key: string;
  amount: number;
  category: string;
  subcategory: string | null;
  note: string | null;
  created_at: string;
}

interface CategoryRow {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface SubcategoryRow {
  id: string;
  category_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ImportCategoryDefinitionsResult {
  importedCategoryCount: number;
  importedSubcategoryCount: number;
  skippedCategoryCount: number;
  skippedSubcategoryCount: number;
}

function mapExpenseRow(row: ExpenseRow): ExpenseEntry {
  return {
    id: row.id,
    monthKey: row.month_key,
    amount: row.amount,
    category: row.category,
    subcategory: row.subcategory,
    note: row.note,
    createdAt: row.created_at,
  };
}

function mapSubcategoryRow(row: SubcategoryRow): SubcategoryRecord {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCategoryRow(row: CategoryRow, subcategories: SubcategoryRecord[]): CategoryRecord {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    subcategories,
  };
}

async function getAllCategoryRows(db: SQLiteDatabase) {
  return db.getAllAsync<CategoryRow>(
    `SELECT id, name, color, sort_order, created_at, updated_at
     FROM categories
     ORDER BY sort_order ASC, created_at ASC`
  );
}

async function getAllSubcategoryRows(db: SQLiteDatabase) {
  return db.getAllAsync<SubcategoryRow>(
    `SELECT id, category_id, name, sort_order, created_at, updated_at
     FROM subcategories
     ORDER BY sort_order ASC, created_at ASC`
  );
}

async function seedDefaultCategories(db: SQLiteDatabase) {
  await db.withTransactionAsync(async () => {
    for (const [categoryIndex, definition] of CATEGORY_DEFINITIONS.entries()) {
      const categoryId = createId();
      const timestamp = new Date().toISOString();

      await db.runAsync(
        `INSERT INTO categories (id, name, color, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [categoryId, definition.name, definition.color, categoryIndex, timestamp, timestamp]
      );

      for (const [subcategoryIndex, name] of definition.subcategories.entries()) {
        await db.runAsync(
          `INSERT INTO subcategories (id, category_id, name, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [createId(), categoryId, name, subcategoryIndex, timestamp, timestamp]
        );
      }
    }
  });
}

async function insertCategoryDefinition(
  db: SQLiteDatabase,
  category: CategoryRecord,
  categoryId = category.id
) {
  await db.runAsync(
    `INSERT INTO categories (id, name, color, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [categoryId, category.name, category.color, category.sortOrder, category.createdAt, category.updatedAt]
  );

  for (const subcategory of category.subcategories) {
    await db.runAsync(
      `INSERT INTO subcategories (id, category_id, name, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        subcategory.id,
        categoryId,
        subcategory.name,
        subcategory.sortOrder,
        subcategory.createdAt,
        subcategory.updatedAt,
      ]
    );
  }
}

export async function initializeDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      month_key TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      subcategory TEXT,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subcategories (
      id TEXT PRIMARY KEY NOT NULL,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_month_key ON expenses(month_key);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);
    CREATE INDEX IF NOT EXISTS idx_subcategories_category_sort ON subcategories(category_id, sort_order);
  `);

  const categories = await getAllCategoryRows(db);

  if (categories.length === 0) {
    await seedDefaultCategories(db);
  }
}

export async function getAllExpenses(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<ExpenseRow>(
    `SELECT id, month_key, amount, category, subcategory, note, created_at
     FROM expenses
     ORDER BY month_key DESC, created_at DESC`
  );

  return rows.map(mapExpenseRow);
}

export async function getAllCategories(db: SQLiteDatabase): Promise<CategoryRecord[]> {
  const [categoryRows, subcategoryRows] = await Promise.all([getAllCategoryRows(db), getAllSubcategoryRows(db)]);
  const subcategoriesByCategoryId = new Map<string, SubcategoryRecord[]>();

  for (const row of subcategoryRows) {
    const mapped = mapSubcategoryRow(row);
    const bucket = subcategoriesByCategoryId.get(mapped.categoryId) ?? [];
    bucket.push(mapped);
    subcategoriesByCategoryId.set(mapped.categoryId, bucket);
  }

  return categoryRows.map((row) => mapCategoryRow(row, subcategoriesByCategoryId.get(row.id) ?? []));
}

export async function exportAllExpenses(db: SQLiteDatabase) {
  return getAllExpenses(db);
}

export async function exportAllCategories(db: SQLiteDatabase) {
  return getAllCategories(db);
}

export async function insertExpense(db: SQLiteDatabase, draft: ExpenseDraft) {
  const id = createId();
  const createdAt = new Date().toISOString();
  const syntheticDate = `${draft.monthKey}-01`;

  await db.runAsync(
    `INSERT INTO expenses (id, date, month_key, amount, category, subcategory, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      syntheticDate,
      draft.monthKey,
      draft.amount,
      draft.category,
      draft.subcategory,
      draft.note,
      createdAt,
    ]
  );
}

export async function deleteExpenseById(db: SQLiteDatabase, id: string) {
  await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
}

export async function clearAllExpenses(db: SQLiteDatabase) {
  await db.runAsync('DELETE FROM expenses');
}

export async function createCategory(db: SQLiteDatabase, input: CreateCategoryInput) {
  const categories = await getAllCategories(db);
  const timestamp = new Date().toISOString();
  const color = input.color ?? getSeedColorByIndex(categories.length);

  await db.runAsync(
    `INSERT INTO categories (id, name, color, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [createId(), input.name, color, categories.length, timestamp, timestamp]
  );
}

export async function updateCategoryOrder(db: SQLiteDatabase, idsInOrder: string[]) {
  await db.withTransactionAsync(async () => {
    for (const [sortOrder, id] of idsInOrder.entries()) {
      await db.runAsync('UPDATE categories SET sort_order = ?, updated_at = ? WHERE id = ?', [
        sortOrder,
        new Date().toISOString(),
        id,
      ]);
    }
  });
}

export async function renameCategory(db: SQLiteDatabase, id: string, name: string) {
  const category = (await getAllCategories(db)).find((item) => item.id === id);

  if (!category) {
    return;
  }

  const updatedAt = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE categories SET name = ?, updated_at = ? WHERE id = ?', [name, updatedAt, id]);
    await db.runAsync('UPDATE expenses SET category = ? WHERE category = ?', [name, category.name]);
  });
}

export async function deleteCategory(db: SQLiteDatabase, id: string) {
  const category = (await getAllCategories(db)).find((item) => item.id === id);

  if (!category) {
    return;
  }

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM subcategories WHERE category_id = ?', [id]);
    await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
  });
}

export async function getCategoryUsageSummary(db: SQLiteDatabase, id: string): Promise<CategoryUsageSummary> {
  const category = (await getAllCategories(db)).find((item) => item.id === id);

  if (!category) {
    return {
      categoryId: id,
      categoryName: '',
      expenseCount: 0,
    };
  }

  const expenses = await getAllExpenses(db);

  return {
    categoryId: category.id,
    categoryName: category.name,
    expenseCount: expenses.filter((entry) => entry.category === category.name).length,
  };
}

export async function createSubcategory(db: SQLiteDatabase, categoryId: string, name: string) {
  const category = (await getAllCategories(db)).find((item) => item.id === categoryId);

  if (!category) {
    return;
  }

  const timestamp = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO subcategories (id, category_id, name, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [createId(), categoryId, name, category.subcategories.length, timestamp, timestamp]
  );
}

export async function renameSubcategory(db: SQLiteDatabase, id: string, name: string) {
  const categories = await getAllCategories(db);
  const category = categories.find((item) => item.subcategories.some((subcategory) => subcategory.id === id));
  const subcategory = category?.subcategories.find((item) => item.id === id);

  if (!category || !subcategory) {
    return;
  }

  const updatedAt = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE subcategories SET name = ?, updated_at = ? WHERE id = ?', [name, updatedAt, id]);
    await db.runAsync('UPDATE expenses SET subcategory = ? WHERE category = ? AND subcategory = ?', [
      name,
      category.name,
      subcategory.name,
    ]);
  });
}

export async function deleteSubcategory(db: SQLiteDatabase, id: string) {
  await db.runAsync('DELETE FROM subcategories WHERE id = ?', [id]);
}

export async function getSubcategoryUsageSummary(
  db: SQLiteDatabase,
  id: string
): Promise<SubcategoryUsageSummary> {
  const categories = await getAllCategories(db);
  const category = categories.find((item) => item.subcategories.some((subcategory) => subcategory.id === id));
  const subcategory = category?.subcategories.find((item) => item.id === id);

  if (!category || !subcategory) {
    return {
      subcategoryId: id,
      categoryId: '',
      categoryName: '',
      subcategoryName: '',
      expenseCount: 0,
    };
  }

  const expenses = await getAllExpenses(db);

  return {
    subcategoryId: subcategory.id,
    categoryId: category.id,
    categoryName: category.name,
    subcategoryName: subcategory.name,
    expenseCount: expenses.filter(
      (entry) => entry.category === category.name && entry.subcategory === subcategory.name
    ).length,
  };
}

export async function replaceAllCategoryDefinitions(db: SQLiteDatabase, categories: CategoryRecord[]) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM subcategories');
    await db.runAsync('DELETE FROM categories');

    for (const category of categories) {
      await insertCategoryDefinition(db, category);
    }
  });
}

export async function mergeCategoryDefinitions(
  db: SQLiteDatabase,
  importedCategories: CategoryRecord[]
): Promise<ImportCategoryDefinitionsResult> {
  let result: ImportCategoryDefinitionsResult = {
    importedCategoryCount: 0,
    importedSubcategoryCount: 0,
    skippedCategoryCount: 0,
    skippedSubcategoryCount: 0,
  };

  await db.withTransactionAsync(async () => {
    let existingCategories = await getAllCategories(db);
    const categoryByName = new Map(existingCategories.map((category) => [category.name, category]));

    for (const importedCategory of importedCategories) {
      let targetCategory = categoryByName.get(importedCategory.name);

      if (!targetCategory) {
        const createdCategory: CategoryRecord = {
          ...importedCategory,
          id: createId(),
          sortOrder: existingCategories.length,
          subcategories: [],
        };

        await insertCategoryDefinition(db, createdCategory);
        result.importedCategoryCount += 1;
        existingCategories = [...existingCategories, createdCategory];
        targetCategory = createdCategory;
        categoryByName.set(targetCategory.name, targetCategory);
      } else {
        result.skippedCategoryCount += 1;
      }

      const existingSubcategoryNames = new Set(targetCategory.subcategories.map((subcategory) => subcategory.name));
      let nextSubcategoryOrder = targetCategory.subcategories.length;

      for (const importedSubcategory of importedCategory.subcategories) {
        if (existingSubcategoryNames.has(importedSubcategory.name)) {
          result.skippedSubcategoryCount += 1;
          continue;
        }

        const createdSubcategory: SubcategoryRecord = {
          ...importedSubcategory,
          id: createId(),
          categoryId: targetCategory.id,
          sortOrder: nextSubcategoryOrder,
        };

        await db.runAsync(
          `INSERT INTO subcategories (id, category_id, name, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            createdSubcategory.id,
            createdSubcategory.categoryId,
            createdSubcategory.name,
            createdSubcategory.sortOrder,
            createdSubcategory.createdAt,
            createdSubcategory.updatedAt,
          ]
        );

        result.importedSubcategoryCount += 1;
        existingSubcategoryNames.add(createdSubcategory.name);
        nextSubcategoryOrder += 1;
      }

      existingCategories = await getAllCategories(db);
      const refreshedTarget = existingCategories.find((category) => category.name === targetCategory.name);

      if (refreshedTarget) {
        categoryByName.set(refreshedTarget.name, refreshedTarget);
      }
    }
  });

  return result;
}

export async function importExpensesMerge(
  db: SQLiteDatabase,
  entries: ExpenseEntry[]
): Promise<ImportExpensesResult> {
  let result: ImportExpensesResult = {
    importedCount: 0,
    skippedCount: 0,
  };

  await db.withTransactionAsync(async () => {
    const existingRows = await getAllExpenses(db);
    const existingIds = new Set(existingRows.map((entry) => entry.id));
    const rowsToInsert = entries.filter((entry) => !existingIds.has(entry.id));

    for (const entry of rowsToInsert) {
      await insertImportedExpense(db, entry);
    }

    result = {
      importedCount: rowsToInsert.length,
      skippedCount: entries.length - rowsToInsert.length,
    };
  });

  return result;
}

export async function replaceAllExpenses(
  db: SQLiteDatabase,
  entries: ExpenseEntry[]
): Promise<ImportExpensesResult> {
  let result: ImportExpensesResult = {
    importedCount: 0,
    skippedCount: 0,
  };

  await db.withTransactionAsync(async () => {
    await clearAllExpenses(db);

    for (const entry of entries) {
      await insertImportedExpense(db, entry);
    }

    result = {
      importedCount: entries.length,
      skippedCount: 0,
    };
  });

  return result;
}

async function insertImportedExpense(db: SQLiteDatabase, entry: ExpenseEntry) {
  await db.runAsync(
    `INSERT INTO expenses (id, date, month_key, amount, category, subcategory, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      `${entry.monthKey}-01`,
      entry.monthKey,
      entry.amount,
      entry.category,
      entry.subcategory,
      entry.note,
      entry.createdAt,
    ]
  );
}
