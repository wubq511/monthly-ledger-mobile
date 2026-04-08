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

export interface SubcategoryRecord {
  id: string;
  categoryId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  subcategories: SubcategoryRecord[];
}

export interface CreateCategoryInput {
  name: string;
  color?: string;
}

export interface CategoryUsageSummary {
  categoryId: string;
  categoryName: string;
  expenseCount: number;
}

export interface SubcategoryUsageSummary {
  subcategoryId: string;
  categoryId: string;
  categoryName: string;
  subcategoryName: string;
  expenseCount: number;
}
