import { describe, expect, it } from 'vitest';

import * as ledgerSummary from './ledgerSummary';
import type { CategoryRecord, ExpenseEntry } from '../types/ledger';
import type { BudgetSettings } from '../types/ledger';

type BuildLedgerSummary = (
  entries: ExpenseEntry[],
  categories: CategoryRecord[],
  selectedMonth: string,
  budgetSettings: BudgetSettings,
  formatShortMonthLabel: (monthKey: string) => string
) => any;

const buildLedgerSummary = ledgerSummary.buildLedgerSummary as unknown as BuildLedgerSummary;
const MONTHLY_BUDGET_LIMIT = ledgerSummary.MONTHLY_BUDGET_LIMIT;
const emptyBudgetSettings: BudgetSettings = {
  defaultBudget: null,
  monthlyBudgets: {},
};
const budgetSettings: BudgetSettings = {
  defaultBudget: 2400,
  monthlyBudgets: {
    '2026-03': 1800,
  },
};

const categories: CategoryRecord[] = [
  {
    id: 'category-food',
    name: '饮食',
    color: '#C76439',
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    subcategories: [],
  },
  {
    id: 'category-traffic',
    name: '交通',
    color: '#3A6D9A',
    sortOrder: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    subcategories: [],
  },
];

const entries: ExpenseEntry[] = [
  {
    id: '1',
    dateKey: '2026-01-03',
    monthKey: '2026-01',
    amount: 1200,
    category: '饮食',
    subcategory: '外卖',
    note: null,
    createdAt: '2026-01-03T00:00:00.000Z',
  },
  {
    id: '2',
    dateKey: '2026-01-12',
    monthKey: '2026-01',
    amount: 950,
    category: '娱乐',
    subcategory: null,
    note: null,
    createdAt: '2026-01-12T00:00:00.000Z',
  },
  {
    id: '3',
    dateKey: '2026-02-02',
    monthKey: '2026-02',
    amount: 600,
    category: '饮食',
    subcategory: '食堂',
    note: null,
    createdAt: '2026-02-02T00:00:00.000Z',
  },
  {
    id: '4',
    dateKey: '2026-02-11',
    monthKey: '2026-02',
    amount: 200,
    category: '交通',
    subcategory: null,
    note: null,
    createdAt: '2026-02-11T00:00:00.000Z',
  },
  {
    id: '5',
    dateKey: '2026-03-05',
    monthKey: '2026-03',
    amount: 1500,
    category: '饮食',
    subcategory: '零食/水果/面包',
    note: null,
    createdAt: '2026-03-05T00:00:00.000Z',
  },
  {
    id: '6',
    dateKey: '2026-03-08',
    monthKey: '2026-03',
    amount: 900,
    category: '交通',
    subcategory: null,
    note: null,
    createdAt: '2026-03-08T00:00:00.000Z',
  },
];

describe('buildLedgerSummary', () => {
  it('uses the monthly override before the default budget', () => {
    const summary = buildLedgerSummary(
      entries,
      categories,
      '2026-03',
      budgetSettings,
      (monthKey) => monthKey.slice(5)
    );

    expect(summary.selectedBudget.budgetLimit).toBe(1800);
    expect(summary.selectedBudget.remaining).toBe(0);
    expect(summary.selectedBudget.overspend).toBe(600);
    expect(summary.selectedBudget.utilizationRate).toBeCloseTo(2400 / 1800, 2);
  });

  it('falls back to the default budget when a month has no override', () => {
    const summary = buildLedgerSummary(
      entries,
      categories,
      '2026-02',
      budgetSettings,
      (monthKey) => monthKey.slice(5)
    );

    expect(summary.selectedBudget.budgetLimit).toBe(2400);
    expect(summary.selectedBudget.remaining).toBe(1600);
    expect(summary.selectedBudget.overspend).toBe(0);
  });

  it('keeps the existing 2000 fallback when settings are empty', () => {
    const summary = buildLedgerSummary(
      entries,
      categories,
      '2026-01',
      emptyBudgetSettings,
      (monthKey) => monthKey.slice(5)
    );

    expect(summary.selectedBudget.budgetLimit).toBe(MONTHLY_BUDGET_LIMIT);
    expect(summary.selectedBudget.remaining).toBe(0);
    expect(summary.selectedBudget.overspend).toBe(150);
  });

  it('uses each month own resolved budget when aggregating overspend and remaining totals', () => {
    const summary = buildLedgerSummary(
      entries,
      categories,
      '2026-03',
      budgetSettings,
      (monthKey) => monthKey.slice(5)
    );

    expect(
      summary.monthlyBudgetRows.map((row: ledgerSummary.BudgetMonthRow) => ({
        monthKey: row.monthKey,
        budgetLimit: row.budgetLimit,
      }))
    ).toEqual([
      { monthKey: '2026-03', budgetLimit: 1800 },
      { monthKey: '2026-02', budgetLimit: 2400 },
      { monthKey: '2026-01', budgetLimit: 2400 },
    ]);
    expect(summary.totalOverspend).toBe(600);
    expect(summary.totalRemaining).toBe(1850);
    expect(summary.netBudgetBalance).toBe(1250);
    expect(summary.averageMonthlyOverspend).toBe(200);
    expect(summary.overspendMonthCount).toBe(1);
  });

  it('includes override-only months in monthly budget rows without changing aggregate tracked-month totals', () => {
    const summary = buildLedgerSummary(
      entries,
      categories,
      '2026-03',
      {
        defaultBudget: 2400,
        monthlyBudgets: {
          '2026-03': 1800,
          '2026-04': 900,
        },
      },
      (monthKey) => monthKey.slice(5)
    );

    expect(
      summary.monthlyBudgetRows.map((row: ledgerSummary.BudgetMonthRow) => ({
        monthKey: row.monthKey,
        total: row.total,
        budgetLimit: row.budgetLimit,
      }))
    ).toEqual([
      { monthKey: '2026-04', total: 0, budgetLimit: 900 },
      { monthKey: '2026-03', total: 2400, budgetLimit: 1800 },
      { monthKey: '2026-02', total: 800, budgetLimit: 2400 },
      { monthKey: '2026-01', total: 2150, budgetLimit: 2400 },
    ]);
    expect(summary.totalOverspend).toBe(600);
    expect(summary.totalRemaining).toBe(1850);
    expect(summary.netBudgetBalance).toBe(1250);
    expect(summary.averageMonthlyOverspend).toBe(200);
    expect(summary.overspendMonthCount).toBe(1);
  });

  it('orders selected month category ranking and per-category month ranking', () => {
    const summary = buildLedgerSummary(
      entries,
      categories,
      '2026-03',
      budgetSettings,
      (monthKey) => monthKey.slice(5)
    );

    expect(summary.categoryTotals.map((item: ledgerSummary.CategoryTotal) => item.name)).toEqual([
      '饮食',
      '交通',
    ]);
    expect(summary.selectedMonthRanking.map((item: ledgerSummary.CategoryTotal) => item.name)).toEqual([
      '饮食',
      '交通',
    ]);
    expect(summary.categoryMonthRanking['饮食'].map((item: ledgerSummary.CategoryMonthRankItem) => item.monthKey)).toEqual([
      '2026-03',
      '2026-01',
      '2026-02',
    ]);
    expect(summary.categoryMonthRanking['交通'].map((item: ledgerSummary.CategoryMonthRankItem) => item.monthKey)).toEqual([
      '2026-03',
      '2026-02',
    ]);
  });

  it('keeps deleted historical categories visible in rankings', () => {
    const summary = buildLedgerSummary(
      entries,
      categories,
      '2026-01',
      budgetSettings,
      (monthKey) => monthKey.slice(5)
    );

    expect(summary.selectedMonthRanking.map((item: ledgerSummary.CategoryTotal) => item.name)).toEqual([
      '饮食',
      '娱乐',
    ]);
    expect(summary.categoryMonthRanking['娱乐'].map((item: ledgerSummary.CategoryMonthRankItem) => item.monthKey)).toEqual([
      '2026-01',
    ]);
  });

  it('keeps zero-overspend months at zero and supports empty data', () => {
    const empty = buildLedgerSummary([], categories, '2026-03', emptyBudgetSettings, (monthKey) => monthKey.slice(5));
    const february = buildLedgerSummary(entries, categories, '2026-02', budgetSettings, (monthKey) => monthKey.slice(5));

    expect(empty.totalOverspend).toBe(0);
    expect(empty.totalRemaining).toBe(0);
    expect(empty.netBudgetBalance).toBe(0);
    expect(empty.averageMonthlyOverspend).toBe(0);
    expect(empty.selectedMonthRanking).toEqual([]);
    expect(february.selectedBudget.budgetLimit).toBe(2400);
    expect(february.selectedBudget.overspend).toBe(0);
    expect(february.selectedBudget.remaining).toBe(1600);
  });

  it('returns a negative net budget balance when cumulative overspend exceeds total remaining', () => {
    const overspendHeavy = buildLedgerSummary(
      [
        ...entries,
        {
          id: '7',
          dateKey: '2026-04-02',
          monthKey: '2026-04',
          amount: 5000,
          category: '其他',
          subcategory: null,
          note: null,
          createdAt: '2026-04-02T00:00:00.000Z',
        },
      ],
      categories,
      '2026-04',
      budgetSettings,
      (monthKey) => monthKey.slice(5)
    );

    expect(overspendHeavy.totalOverspend).toBe(3200);
    expect(overspendHeavy.totalRemaining).toBe(1850);
    expect(overspendHeavy.netBudgetBalance).toBe(-1350);
  });
});
