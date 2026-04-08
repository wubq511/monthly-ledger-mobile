import { describe, expect, it } from 'vitest';

import * as expenseFormFlow from './expenseFormFlow';

type GetNextCategoryStep = (
  orderedCategoryNames: string[],
  categoryName: string
) => {
  nextCategory: string | null;
  shouldReturnToOverview: boolean;
};

const getNextCategoryStep = expenseFormFlow.getNextCategoryStep as unknown as GetNextCategoryStep;

describe('getNextCategoryStep', () => {
  it('returns the next category when the current category is not the final one', () => {
    expect(getNextCategoryStep(['饮食', '医疗', '其他'], '饮食')).toEqual({
      nextCategory: '医疗',
      shouldReturnToOverview: false,
    });
  });

  it('returns overview intent when the current category is the final one', () => {
    expect(getNextCategoryStep(['饮食', '医疗', '其他'], '其他')).toEqual({
      nextCategory: null,
      shouldReturnToOverview: true,
    });
  });

  it('falls back to overview intent for unknown categories', () => {
    expect(getNextCategoryStep(['饮食', '医疗', '其他'], '不存在的大类')).toEqual({
      nextCategory: null,
      shouldReturnToOverview: true,
    });
  });

  it('returns the next category based on persisted order', () => {
    expect(getNextCategoryStep(['饮食', '交通', '其他'], '交通')).toEqual({
      nextCategory: '其他',
      shouldReturnToOverview: false,
    });
  });
});
