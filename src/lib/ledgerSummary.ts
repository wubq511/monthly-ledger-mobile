import { CATEGORY_DEFINITIONS } from '../constants/categories';
import { shiftMonth } from './date';
import type { ExpenseEntry } from '../types/ledger';

interface CategoryTotal {
  name: string;
  color: string;
  total: number;
}

interface MonthlyTrendPoint {
  key: string;
  label: string;
  value: number;
}

export interface LedgerSummary {
  selectedEntries: ExpenseEntry[];
  selectedTotal: number;
  selectedCount: number;
  trackedMonthCount: number;
  monthlyAverage: number;
  categoryTotals: CategoryTotal[];
  monthlyTrend: MonthlyTrendPoint[];
  peakMonth: { monthKey: string; total: number } | null;
}

export function buildLedgerSummary(
  entries: ExpenseEntry[],
  selectedMonth: string,
  formatShortMonthLabel: (monthKey: string) => string
): LedgerSummary {
  const monthlyTotals = new Map<string, number>();
  const selectedCategoryTotals = new Map<string, number>();
  const selectedEntries: ExpenseEntry[] = [];
  let grandTotal = 0;
  let selectedTotal = 0;

  for (const entry of entries) {
    const nextMonthTotal = (monthlyTotals.get(entry.monthKey) ?? 0) + entry.amount;
    monthlyTotals.set(entry.monthKey, nextMonthTotal);
    grandTotal += entry.amount;

    if (entry.monthKey !== selectedMonth) {
      continue;
    }

    selectedEntries.push(entry);
    selectedTotal += entry.amount;
    selectedCategoryTotals.set(
      entry.category,
      (selectedCategoryTotals.get(entry.category) ?? 0) + entry.amount
    );
  }

  const trackedMonthCount = monthlyTotals.size;
  const monthlyAverage = trackedMonthCount > 0 ? grandTotal / trackedMonthCount : 0;

  const categoryTotals = CATEGORY_DEFINITIONS.map((definition) => ({
    name: definition.name,
    color: definition.color,
    total: selectedCategoryTotals.get(definition.name) ?? 0,
  }))
    .filter((item) => item.total > 0)
    .sort((left, right) => right.total - left.total);

  const monthlyTrend = Array.from({ length: 6 }, (_, index) => {
    const monthKey = shiftMonth(selectedMonth, index - 5);
    return {
      key: monthKey,
      label: formatShortMonthLabel(monthKey),
      value: monthlyTotals.get(monthKey) ?? 0,
    };
  });

  let peakMonth: { monthKey: string; total: number } | null = null;

  for (const [monthKey, total] of monthlyTotals.entries()) {
    if (!peakMonth || total > peakMonth.total) {
      peakMonth = { monthKey, total };
    }
  }

  return {
    selectedEntries,
    selectedTotal,
    selectedCount: selectedEntries.length,
    trackedMonthCount,
    monthlyAverage,
    categoryTotals,
    monthlyTrend,
    peakMonth,
  };
}
