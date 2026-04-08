import { describe, expect, it } from 'vitest';

import { getBudgetLabelLayout } from './chartLayout';

describe('getBudgetLabelLayout', () => {
  it('keeps the budget label within the right edge of the chart', () => {
    const layout = getBudgetLabelLayout(280, 18, 72);

    expect(layout.left).toBeGreaterThanOrEqual(26);
    expect(layout.right).toBeLessThanOrEqual(254);
    expect(layout.textX).toBeLessThanOrEqual(248);
  });

  it('clamps the label when the chart is narrow', () => {
    const layout = getBudgetLabelLayout(120, 18, 72);

    expect(layout.left).toBe(26);
    expect(layout.right).toBeGreaterThan(layout.left);
    expect(layout.textX).toBeLessThanOrEqual(layout.right - 6);
  });
});
