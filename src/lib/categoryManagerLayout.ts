export function getCategoryManagerLayoutMetrics({
  safeAreaBottom,
  keyboardInset,
  editorVisible,
}: {
  safeAreaBottom: number;
  keyboardInset: number;
  editorVisible: boolean;
}) {
  const modalBottomInset = Math.max(safeAreaBottom, 18) + 16;

  return {
    modalBottomInset,
    editorBottomOffset: editorVisible && keyboardInset > 0 ? keyboardInset + 12 : modalBottomInset,
  };
}
