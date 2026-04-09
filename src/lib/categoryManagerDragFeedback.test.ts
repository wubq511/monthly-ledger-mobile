import { describe, expect, it } from 'vitest';

import { getCategoryManagerDragFeedback } from './categoryManagerDragFeedback';

describe('getCategoryManagerDragFeedback', () => {
  it('keeps category drag feedback inside the modal by avoiding scale changes', () => {
    expect(getCategoryManagerDragFeedback('category')).toEqual({
      liftOffset: 4,
      shadowElevation: 4,
      shadowOpacity: 0.12,
      shadowRadius: 8,
    });
  });

  it('keeps subcategory drag feedback even lighter while preserving size', () => {
    expect(getCategoryManagerDragFeedback('subcategory')).toEqual({
      liftOffset: 2,
      shadowElevation: 3,
      shadowOpacity: 0.1,
      shadowRadius: 6,
    });
  });
});
