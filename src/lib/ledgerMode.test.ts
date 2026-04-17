import { describe, expect, it } from 'vitest';

import {
  formatEntryPeriodLabel,
  getBackNavigationTarget,
  resolveExpensePeriod,
} from './ledgerMode';
import type { ExpenseEntry } from '../types/ledger';

const entry: ExpenseEntry = {
  id: 'entry-1',
  dateKey: '2026-04-17',
  monthKey: '2026-04',
  amount: 32,
  category: '饮食',
  subcategory: '食堂',
  note: null,
  createdAt: '2026-04-17T09:00:00.000Z',
};

describe('ledger mode helpers', () => {
  it('keeps month mode tied to the selected month', () => {
    expect(resolveExpensePeriod('month', '2026-04', '2026-04-17')).toEqual({
      dateKey: '2026-04-01',
      monthKey: '2026-04',
    });
  });

  it('derives the month key from the selected day in day mode', () => {
    expect(resolveExpensePeriod('day', '2026-04', '2026-05-02')).toEqual({
      dateKey: '2026-05-02',
      monthKey: '2026-05',
    });
  });

  it('formats overview entry labels from the active ledger mode', () => {
    expect(formatEntryPeriodLabel(entry, 'month')).toBe('2026年4月');
    expect(formatEntryPeriodLabel(entry, 'day')).toBe('2026年4月17日');
  });

  it('routes Android back to overview before exiting', () => {
    expect(getBackNavigationTarget('overview')).toBeNull();
    expect(getBackNavigationTarget('add')).toBe('overview');
    expect(getBackNavigationTarget('trends')).toBe('overview');
  });
});
