import { describe, expect, it } from 'vitest';

import { buildLedgerSummary, MONTHLY_BUDGET_LIMIT } from './ledgerSummary';
import type { ExpenseEntry } from '../types/ledger';

const entries: ExpenseEntry[] = [
  {
    id: '1',
    monthKey: '2026-01',
    amount: 1200,
    category: '饮食',
    subcategory: '外卖',
    note: null,
    createdAt: '2026-01-03T00:00:00.000Z',
  },
  {
    id: '2',
    monthKey: '2026-01',
    amount: 950,
    category: '娱乐',
    subcategory: null,
    note: null,
    createdAt: '2026-01-12T00:00:00.000Z',
  },
  {
    id: '3',
    monthKey: '2026-02',
    amount: 600,
    category: '饮食',
    subcategory: '食堂',
    note: null,
    createdAt: '2026-02-02T00:00:00.000Z',
  },
  {
    id: '4',
    monthKey: '2026-02',
    amount: 200,
    category: '交通',
    subcategory: null,
    note: null,
    createdAt: '2026-02-11T00:00:00.000Z',
  },
  {
    id: '5',
    monthKey: '2026-03',
    amount: 1500,
    category: '饮食',
    subcategory: '零食/水果/面包',
    note: null,
    createdAt: '2026-03-05T00:00:00.000Z',
  },
  {
    id: '6',
    monthKey: '2026-03',
    amount: 900,
    category: '交通',
    subcategory: null,
    note: null,
    createdAt: '2026-03-08T00:00:00.000Z',
  },
];

describe('buildLedgerSummary', () => {
  it('computes month budget snapshots and overall overspend stats', () => {
    const summary = buildLedgerSummary(entries, '2026-03', (monthKey) => monthKey.slice(5));

    expect(MONTHLY_BUDGET_LIMIT).toBe(2000);
    expect(summary.trackedMonthCount).toBe(3);
    expect(summary.totalOverspend).toBe(550);
    expect(summary.averageMonthlyOverspend).toBeCloseTo(550 / 3, 2);
    expect(summary.overspendMonthCount).toBe(2);
    expect(summary.selectedBudget.remaining).toBe(0);
    expect(summary.selectedBudget.overspend).toBe(400);
    expect(summary.selectedBudget.utilizationRate).toBeCloseTo(1.2, 2);
  });

  it('orders selected month category ranking and per-category month ranking', () => {
    const summary = buildLedgerSummary(entries, '2026-03', (monthKey) => monthKey.slice(5));

    expect(summary.categoryTotals.map((item) => item.name)).toEqual(['饮食', '交通']);
    expect(summary.selectedMonthRanking.map((item) => item.name)).toEqual(['饮食', '交通']);
    expect(summary.categoryMonthRanking['饮食'].map((item) => item.monthKey)).toEqual([
      '2026-03',
      '2026-01',
      '2026-02',
    ]);
    expect(summary.categoryMonthRanking['交通'].map((item) => item.monthKey)).toEqual([
      '2026-03',
      '2026-02',
    ]);
  });

  it('keeps zero-overspend months at zero and supports empty data', () => {
    const empty = buildLedgerSummary([], '2026-03', (monthKey) => monthKey.slice(5));
    const february = buildLedgerSummary(entries, '2026-02', (monthKey) => monthKey.slice(5));

    expect(empty.totalOverspend).toBe(0);
    expect(empty.averageMonthlyOverspend).toBe(0);
    expect(empty.selectedMonthRanking).toEqual([]);
    expect(february.selectedBudget.overspend).toBe(0);
    expect(february.selectedBudget.remaining).toBe(MONTHLY_BUDGET_LIMIT - 800);
  });
});
