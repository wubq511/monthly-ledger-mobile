import type { BudgetSettings } from '../types/ledger';

export type BudgetModeLabel = 'monthly' | 'default';

export function parseBudgetAmountInput(raw: string) {
  const normalized = Number(raw.trim());

  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }

  return normalized;
}

export function getBudgetModeLabel(monthKey: string, settings: BudgetSettings): BudgetModeLabel {
  return Object.prototype.hasOwnProperty.call(settings.monthlyBudgets, monthKey) ? 'monthly' : 'default';
}
