export interface BudgetLabelLayout {
  left: number;
  right: number;
  textX: number;
}

export function getChartCanvasWidth(frameWidth: number, framePadding: number) {
  return Math.max(frameWidth - framePadding * 2, 0);
}

export function getBudgetLabelLayout(
  chartWidth: number,
  chartPadding: number,
  labelWidth: number,
  edgeInset: number = 8
): BudgetLabelLayout {
  const safeLeft = chartPadding + edgeInset;
  const safeRight = chartWidth - chartPadding - edgeInset;
  const right = Math.max(safeLeft + 12, safeRight);
  const left = Math.max(safeLeft, right - labelWidth);

  return {
    left,
    right,
    textX: right - 6,
  };
}
