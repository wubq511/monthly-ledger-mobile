import { formatDateLabel, formatMonthLabel, getMonthKeyFromDateKey } from './date';
import type { ExpenseEntry, LedgerMode, TabKey } from '../types/ledger';

export function resolveExpensePeriod(mode: LedgerMode, monthKey: string, dateKey: string) {
  if (mode === 'day') {
    return {
      dateKey,
      monthKey: getMonthKeyFromDateKey(dateKey),
    };
  }

  return {
    dateKey: `${monthKey}-01`,
    monthKey,
  };
}

export function formatEntryPeriodLabel(entry: ExpenseEntry, mode: LedgerMode) {
  return mode === 'day' ? formatDateLabel(entry.dateKey) : formatMonthLabel(entry.monthKey);
}

export function getBackNavigationTarget(activeTab: TabKey): TabKey | null {
  return activeTab === 'overview' ? null : 'overview';
}
