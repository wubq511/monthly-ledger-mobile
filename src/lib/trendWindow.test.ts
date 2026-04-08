import { describe, expect, it } from 'vitest';

import { buildTrendWindowMonths, getTrendMonthAfterSwipe } from './trendWindow';

describe('buildTrendWindowMonths', () => {
  it('builds a six-month window ending at the selected month', () => {
    expect(buildTrendWindowMonths('2026-03')).toEqual([
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
    ]);
  });
});

describe('getTrendMonthAfterSwipe', () => {
  it('moves forward one month after a left swipe', () => {
    expect(getTrendMonthAfterSwipe('2026-03', -48)).toBe('2026-04');
  });

  it('moves backward one month after a right swipe', () => {
    expect(getTrendMonthAfterSwipe('2026-03', 48)).toBe('2026-02');
  });

  it('keeps the current month when the swipe is below threshold', () => {
    expect(getTrendMonthAfterSwipe('2026-03', 16)).toBe('2026-03');
  });
});
