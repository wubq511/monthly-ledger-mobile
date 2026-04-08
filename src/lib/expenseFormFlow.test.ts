import { describe, expect, it } from 'vitest';

import { getNextCategoryStep } from './expenseFormFlow';

describe('getNextCategoryStep', () => {
  it('returns the next category when the current category is not the final one', () => {
    expect(getNextCategoryStep('饮食')).toEqual({
      nextCategory: '医疗',
      shouldReturnToOverview: false,
    });
  });

  it('returns overview intent when the current category is the final one', () => {
    expect(getNextCategoryStep('其他')).toEqual({
      nextCategory: null,
      shouldReturnToOverview: true,
    });
  });

  it('falls back to overview intent for unknown categories', () => {
    expect(getNextCategoryStep('不存在的大类')).toEqual({
      nextCategory: null,
      shouldReturnToOverview: true,
    });
  });
});
