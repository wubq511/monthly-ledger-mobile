import type { SQLiteDatabase } from 'expo-sqlite';

import type { ExpenseDraft, ExpenseEntry, ImportExpensesResult } from '../types/ledger';

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

    CREATE INDEX IF NOT EXISTS idx_expenses_month_key ON expenses(month_key);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
  `);
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

export async function getAllExpenses(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<ExpenseRow>(
    `SELECT id, month_key, amount, category, subcategory, note, created_at
     FROM expenses
     ORDER BY month_key DESC, created_at DESC`
  );

  return rows.map(mapExpenseRow);
}

export async function exportAllExpenses(db: SQLiteDatabase) {
  return getAllExpenses(db);
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
