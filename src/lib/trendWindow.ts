import { shiftMonth } from './date';

export const TREND_WINDOW_SIZE = 6;
export const TREND_SWIPE_THRESHOLD = 36;

export function buildTrendWindowMonths(
  selectedMonth: string,
  size: number = TREND_WINDOW_SIZE
) {
  return Array.from({ length: size }, (_, index) => shiftMonth(selectedMonth, index - (size - 1)));
}

export function getTrendMonthAfterSwipe(
  selectedMonth: string,
  dx: number,
  threshold: number = TREND_SWIPE_THRESHOLD
) {
  if (dx <= -threshold) {
    return shiftMonth(selectedMonth, 1);
  }

  if (dx >= threshold) {
    return shiftMonth(selectedMonth, -1);
  }

  return selectedMonth;
}
