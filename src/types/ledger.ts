export type TabKey = 'overview' | 'add' | 'trends';

export interface ExpenseEntry {
  id: string;
  monthKey: string;
  amount: number;
  category: string;
  subcategory: string | null;
  note: string | null;
  createdAt: string;
}

export interface ExpenseDraft {
  monthKey: string;
  amount: number;
  category: string;
  subcategory: string | null;
  note: string | null;
}

export interface LedgerBackupFile {
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  entries: ExpenseEntry[];
}

export interface ImportExpensesResult {
  importedCount: number;
  skippedCount: number;
}

export interface CategoryDefinition {
  name: string;
  color: string;
  subcategories: string[];
}
