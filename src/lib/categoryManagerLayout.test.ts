import { describe, expect, it } from 'vitest';

import { getCategoryManagerLayoutMetrics } from './categoryManagerLayout';

describe('getCategoryManagerLayoutMetrics', () => {
  it('keeps the modal and floating editor above the safe area when the editor is hidden', () => {
    expect(
      getCategoryManagerLayoutMetrics({
        safeAreaBottom: 8,
        keyboardInset: 0,
        editorVisible: false,
      })
    ).toEqual({
      modalBottomInset: 34,
      editorBottomOffset: 34,
    });
  });

  it('anchors the floating editor to the modal footer when the keyboard is hidden', () => {
    expect(
      getCategoryManagerLayoutMetrics({
        safeAreaBottom: 12,
        keyboardInset: 0,
        editorVisible: true,
      })
    ).toEqual({
      modalBottomInset: 34,
      editorBottomOffset: 34,
    });
  });

  it('keeps the modal in place while lifting only the editor above the keyboard', () => {
    expect(
      getCategoryManagerLayoutMetrics({
        safeAreaBottom: 12,
        keyboardInset: 260,
        editorVisible: true,
      })
    ).toEqual({
      modalBottomInset: 34,
      editorBottomOffset: 272,
    });
  });
});
