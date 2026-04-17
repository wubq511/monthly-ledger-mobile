import { describe, expect, it } from 'vitest';

import { getBudgetModeLabel, parseBudgetAmountInput } from './budgetInput';

describe('budgetInput helpers', () => {
  it('parses valid budget input after trimming whitespace', () => {
    expect(parseBudgetAmountInput(' 3200 ')).toBe(3200);
    expect(parseBudgetAmountInput(' 3200.50 ')).toBe(3200.5);
  });

  it('rejects zero, negative, and invalid budget input', () => {
    expect(parseBudgetAmountInput('0')).toBeNull();
    expect(parseBudgetAmountInput('-20')).toBeNull();
    expect(parseBudgetAmountInput('abc')).toBeNull();
    expect(parseBudgetAmountInput('')).toBeNull();
  });

  it('describes whether the current month uses a monthly override', () => {
    expect(
      getBudgetModeLabel('2026-04', {
        defaultBudget: 2600,
        monthlyBudgets: { '2026-04': 3000 },
      })
    ).toBe('monthly');

    expect(
      getBudgetModeLabel('2026-05', {
        defaultBudget: 2600,
        monthlyBudgets: { '2026-04': 3000 },
      })
    ).toBe('default');
  });
});
