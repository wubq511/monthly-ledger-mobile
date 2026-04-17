import { describe, expect, it } from 'vitest';

import * as date from './date';

describe('date helpers', () => {
  it('validates day-level date input', () => {
    expect(date.isValidDateInput('2026-04-17')).toBe(true);
    expect(date.isValidDateInput('2026-04-31')).toBe(false);
    expect(date.isValidDateInput('2026-13-01')).toBe(false);
  });

  it('derives the month key from a date key', () => {
    expect(date.getMonthKeyFromDateKey('2026-04-17')).toBe('2026-04');
  });

  it('formats a date key for display', () => {
    expect(date.formatDateLabel('2026-04-17')).toBe('2026年4月17日');
  });
});
