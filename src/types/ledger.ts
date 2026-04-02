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

export interface CategoryDefinition {
  name: string;
  color: string;
  subcategories: string[];
}
