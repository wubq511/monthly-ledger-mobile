import { describe, expect, it } from 'vitest';

import * as expenseFormFlow from './expenseFormFlow';
import type { CategoryRecord } from '../types/ledger';

type GetNextCategoryStep = (
  categories: CategoryRecord[],
  categoryName: string,
  subcategoryName: string | null
) => {
  nextCategory: string | null;
  nextSubcategory: string | null;
  shouldReturnToOverview: boolean;
};

const getNextCategoryStep = expenseFormFlow.getNextCategoryStep as unknown as GetNextCategoryStep;

const orderedCategories: CategoryRecord[] = [
  {
    id: 'cat-food',
    name: '饮食',
    color: '#E07A5F',
    sortOrder: 0,
    createdAt: '2026-04-09T00:00:00.000Z',
    updatedAt: '2026-04-09T00:00:00.000Z',
    subcategories: [
      {
        id: 'sub-canteen',
        categoryId: 'cat-food',
        name: '食堂',
        sortOrder: 0,
        createdAt: '2026-04-09T00:00:00.000Z',
        updatedAt: '2026-04-09T00:00:00.000Z',
      },
      {
        id: 'sub-takeout',
        categoryId: 'cat-food',
        name: '外卖',
        sortOrder: 1,
        createdAt: '2026-04-09T00:00:00.000Z',
        updatedAt: '2026-04-09T00:00:00.000Z',
      },
    ],
  },
  {
    id: 'cat-traffic',
    name: '交通',
    color: '#81B29A',
    sortOrder: 1,
    createdAt: '2026-04-09T00:00:00.000Z',
    updatedAt: '2026-04-09T00:00:00.000Z',
    subcategories: [
      {
        id: 'sub-subway',
        categoryId: 'cat-traffic',
        name: '地铁',
        sortOrder: 0,
        createdAt: '2026-04-09T00:00:00.000Z',
        updatedAt: '2026-04-09T00:00:00.000Z',
      },
    ],
  },
  {
    id: 'cat-other',
    name: '其他',
    color: '#3D405B',
    sortOrder: 2,
    createdAt: '2026-04-09T00:00:00.000Z',
    updatedAt: '2026-04-09T00:00:00.000Z',
    subcategories: [],
  },
];

describe('getNextCategoryStep', () => {
  it('moves to the next subcategory before changing category', () => {
    expect(getNextCategoryStep(orderedCategories, '饮食', '食堂')).toEqual({
      nextCategory: '饮食',
      nextSubcategory: '外卖',
      shouldReturnToOverview: false,
    });
  });

  it('moves to the next category after the last subcategory', () => {
    expect(getNextCategoryStep(orderedCategories, '饮食', '外卖')).toEqual({
      nextCategory: '交通',
      nextSubcategory: '地铁',
      shouldReturnToOverview: false,
    });
  });

  it('moves directly to the next category when the current category has no subcategories', () => {
    expect(getNextCategoryStep(orderedCategories, '交通', '地铁')).toEqual({
      nextCategory: '其他',
      nextSubcategory: null,
      shouldReturnToOverview: false,
    });
  });

  it('keeps advancing inside the final category when it still has later subcategories', () => {
    const finalCategoryWithChildren: CategoryRecord[] = [
      orderedCategories[0]!,
      {
        ...orderedCategories[2]!,
        subcategories: [
          {
            id: 'sub-misc-a',
            categoryId: 'cat-other',
            name: '杂项 A',
            sortOrder: 0,
            createdAt: '2026-04-09T00:00:00.000Z',
            updatedAt: '2026-04-09T00:00:00.000Z',
          },
          {
            id: 'sub-misc-b',
            categoryId: 'cat-other',
            name: '杂项 B',
            sortOrder: 1,
            createdAt: '2026-04-09T00:00:00.000Z',
            updatedAt: '2026-04-09T00:00:00.000Z',
          },
        ],
      },
    ];

    expect(getNextCategoryStep(finalCategoryWithChildren, '其他', '杂项 A')).toEqual({
      nextCategory: '其他',
      nextSubcategory: '杂项 B',
      shouldReturnToOverview: false,
    });
  });

  it('returns overview intent when already at the final category position', () => {
    expect(getNextCategoryStep(orderedCategories, '其他', null)).toEqual({
      nextCategory: null,
      nextSubcategory: null,
      shouldReturnToOverview: true,
    });
  });

  it('falls back to overview intent for unknown categories', () => {
    expect(getNextCategoryStep(orderedCategories, '不存在的大类', null)).toEqual({
      nextCategory: null,
      nextSubcategory: null,
      shouldReturnToOverview: true,
    });
  });
});
