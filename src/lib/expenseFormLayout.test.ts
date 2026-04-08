import { describe, expect, it } from 'vitest';

import { getExpenseFormLayoutMetrics, getKeyboardInset } from './expenseFormLayout';

describe('getKeyboardInset', () => {
  it('prefers the visible keyboard height derived from screenY', () => {
    expect(getKeyboardInset(800, 520, 260)).toBe(280);
  });

  it('falls back to reported keyboard height when screenY is unavailable', () => {
    expect(getKeyboardInset(800, undefined, 248)).toBe(248);
  });

  it('returns zero when no keyboard metrics are available', () => {
    expect(getKeyboardInset(800, undefined, undefined)).toBe(0);
  });
});

describe('getExpenseFormLayoutMetrics', () => {
  it('uses the safe-area footer when keyboard is hidden', () => {
    expect(getExpenseFormLayoutMetrics({ safeAreaBottom: 8, keyboardInset: 0 })).toEqual({
      compactSubmit: false,
      contentBottomPadding: 152,
      submitBottomOffset: 0,
      submitFooterInset: 108,
    });
  });

  it('moves the compact submit button above the keyboard', () => {
    expect(getExpenseFormLayoutMetrics({ safeAreaBottom: 12, keyboardInset: 260 })).toEqual({
      compactSubmit: true,
      contentBottomPadding: 360,
      submitBottomOffset: 272,
      submitFooterInset: 0,
    });
  });
});
