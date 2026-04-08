import { describe, expect, it } from 'vitest';

import { getBudgetLabelLayout, getChartCanvasWidth } from './chartLayout';

describe('getChartCanvasWidth', () => {
  it('removes the card padding from the measured frame width', () => {
    expect(getChartCanvasWidth(320, 16)).toBe(288);
  });
});

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

  it('supports a short budget label close to the right edge', () => {
    const layout = getBudgetLabelLayout(288, 18, 60, 4);

    expect(layout.left).toBeGreaterThanOrEqual(22);
    expect(layout.right).toBeLessThanOrEqual(266);
    expect(layout.textX).toBeLessThanOrEqual(260);
  });
});
