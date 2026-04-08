export function getKeyboardInset(
  windowHeight: number,
  keyboardScreenY?: number,
  keyboardHeight?: number
) {
  const insetFromScreen =
    typeof keyboardScreenY === 'number' ? Math.max(windowHeight - keyboardScreenY, 0) : 0;
  const insetFromHeight = typeof keyboardHeight === 'number' ? Math.max(keyboardHeight, 0) : 0;

  return Math.max(insetFromScreen, insetFromHeight);
}

export function getExpenseFormLayoutMetrics({
  safeAreaBottom,
  keyboardInset,
}: {
  safeAreaBottom: number;
  keyboardInset: number;
}) {
  const baseInset = Math.max(safeAreaBottom, 12) + 96;

  if (keyboardInset > 0) {
    return {
      compactSubmit: true,
      contentBottomPadding: keyboardInset + 100,
      submitBottomOffset: keyboardInset + 12,
      submitFooterInset: 0,
    };
  }

  return {
    compactSubmit: false,
    contentBottomPadding: baseInset + 44,
    submitBottomOffset: 0,
    submitFooterInset: baseInset,
  };
}
