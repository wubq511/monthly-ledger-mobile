import { CATEGORY_DEFINITIONS, getCategoryDefinition } from '../constants/categories';
import { shiftMonth } from './date';
import type { ExpenseEntry } from '../types/ledger';

export interface CategoryTotal {
  name: string;
  color: string;
  total: number;
  ratio: number;
}

export interface MonthlyTrendPoint {
  key: string;
  label: string;
  value: number;
}

export interface BudgetSnapshot {
  total: number;
  remaining: number;
  overspend: number;
  utilizationRate: number;
  isOverBudget: boolean;
}

export interface BudgetMonthRow extends BudgetSnapshot {
  monthKey: string;
  label: string;
}

export interface CategoryMonthRankItem {
  monthKey: string;
  label: string;
  total: number;
}

export interface LedgerSummary {
  selectedEntries: ExpenseEntry[];
  selectedTotal: number;
  selectedCount: number;
  trackedMonthCount: number;
  monthlyAverage: number;
  categoryTotals: CategoryTotal[];
  selectedMonthRanking: CategoryTotal[];
  categoryMonthRanking: Record<string, CategoryMonthRankItem[]>;
  defaultCategoryRankingName: string | null;
  selectedBudget: BudgetSnapshot;
  monthlyBudgetRows: BudgetMonthRow[];
  overspendRanking: BudgetMonthRow[];
  totalOverspend: number;
  averageMonthlyOverspend: number;
  overspendMonthCount: number;
  monthlyTrend: MonthlyTrendPoint[];
  peakMonth: { monthKey: string; total: number } | null;
}

export const MONTHLY_BUDGET_LIMIT = 2000;

function buildBudgetSnapshot(total: number): BudgetSnapshot {
  const overspend = Math.max(total - MONTHLY_BUDGET_LIMIT, 0);
  const remaining = Math.max(MONTHLY_BUDGET_LIMIT - total, 0);
  const utilizationRate = MONTHLY_BUDGET_LIMIT > 0 ? total / MONTHLY_BUDGET_LIMIT : 0;

  return {
    total,
    remaining,
    overspend,
    utilizationRate,
    isOverBudget: overspend > 0,
  };
}

function sortCategoryTotals(left: CategoryTotal, right: CategoryTotal) {
  if (right.total !== left.total) {
    return right.total - left.total;
  }

  return left.name.localeCompare(right.name, 'zh-Hans-CN');
}

function sortCategoryMonthItems(left: CategoryMonthRankItem, right: CategoryMonthRankItem) {
  if (right.total !== left.total) {
    return right.total - left.total;
  }

  return right.monthKey.localeCompare(left.monthKey);
}

function sortBudgetRowsByMonth(left: BudgetMonthRow, right: BudgetMonthRow) {
  return right.monthKey.localeCompare(left.monthKey);
}

function sortBudgetRowsByOverspend(left: BudgetMonthRow, right: BudgetMonthRow) {
  if (right.overspend !== left.overspend) {
    return right.overspend - left.overspend;
  }

  return right.monthKey.localeCompare(left.monthKey);
}

export function buildLedgerSummary(
  entries: ExpenseEntry[],
  selectedMonth: string,
  formatShortMonthLabel: (monthKey: string) => string
): LedgerSummary {
  const monthlyTotals = new Map<string, number>();
  const monthCategoryTotals = new Map<string, Map<string, number>>();
  const selectedCategoryTotals = new Map<string, number>();
  const selectedEntries: ExpenseEntry[] = [];
  let grandTotal = 0;
  let selectedTotal = 0;

  for (const entry of entries) {
    monthlyTotals.set(entry.monthKey, (monthlyTotals.get(entry.monthKey) ?? 0) + entry.amount);
    grandTotal += entry.amount;

    const categoryTotalsForMonth = monthCategoryTotals.get(entry.monthKey) ?? new Map<string, number>();
    categoryTotalsForMonth.set(
      entry.category,
      (categoryTotalsForMonth.get(entry.category) ?? 0) + entry.amount
    );
    monthCategoryTotals.set(entry.monthKey, categoryTotalsForMonth);

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

  const selectedMonthRanking = Array.from(selectedCategoryTotals.entries())
    .map(([name, total]) => ({
      name,
      color: getCategoryDefinition(name).color,
      total,
      ratio: selectedTotal > 0 ? total / selectedTotal : 0,
    }))
    .sort(sortCategoryTotals);

  const categoryTotals = selectedMonthRanking;
  const selectedBudget = buildBudgetSnapshot(selectedTotal);

  const monthlyBudgetRows = Array.from(monthlyTotals.entries())
    .map(([monthKey, total]) => ({
      monthKey,
      label: formatShortMonthLabel(monthKey),
      ...buildBudgetSnapshot(total),
    }))
    .sort(sortBudgetRowsByMonth);

  let totalOverspend = 0;
  let overspendMonthCount = 0;

  for (const row of monthlyBudgetRows) {
    totalOverspend += row.overspend;

    if (row.isOverBudget) {
      overspendMonthCount += 1;
    }
  }

  const averageMonthlyOverspend = trackedMonthCount > 0 ? totalOverspend / trackedMonthCount : 0;
  const overspendRanking = monthlyBudgetRows.filter((row) => row.isOverBudget).sort(sortBudgetRowsByOverspend);

  const categoryMonthRanking = CATEGORY_DEFINITIONS.reduce<Record<string, CategoryMonthRankItem[]>>(
    (result, definition) => {
      const rows = Array.from(monthCategoryTotals.entries())
        .map(([monthKey, totals]) => {
          const total = totals.get(definition.name) ?? 0;

          if (total <= 0) {
            return null;
          }

          return {
            monthKey,
            label: formatShortMonthLabel(monthKey),
            total,
          };
        })
        .filter((item): item is CategoryMonthRankItem => item !== null)
        .sort(sortCategoryMonthItems);

      if (rows.length > 0) {
        result[definition.name] = rows;
      }

      return result;
    },
    {}
  );

  let defaultCategoryRankingName = selectedMonthRanking[0]?.name ?? null;

  if (!defaultCategoryRankingName) {
    defaultCategoryRankingName = Object.keys(categoryMonthRanking)[0] ?? null;
  }

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
    selectedMonthRanking,
    categoryMonthRanking,
    defaultCategoryRankingName,
    selectedBudget,
    monthlyBudgetRows,
    overspendRanking,
    totalOverspend,
    averageMonthlyOverspend,
    overspendMonthCount,
    monthlyTrend,
    peakMonth,
  };
}
