import { describe, expect, it } from 'vitest';

import {
  buildManagedCategoryCards,
  resolveManagedCategoryId,
  resolveManagedExpandedCategoryId,
  toggleManagedExpandedCategoryId,
} from './categoryManagerSelection';
import type { CategoryRecord } from '../types/ledger';

const categories: CategoryRecord[] = [
  {
    id: 'food',
    name: '饮食',
    color: '#C76439',
    sortOrder: 0,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    subcategories: [
      {
        id: 'canteen',
        categoryId: 'food',
        name: '食堂',
        sortOrder: 0,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      },
      {
        id: 'takeout',
        categoryId: 'food',
        name: '外卖',
        sortOrder: 1,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      },
    ],
  },
  {
    id: 'medical',
    name: '医疗',
    color: '#7E6C61',
    sortOrder: 1,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    subcategories: [],
  },
];

describe('resolveManagedCategoryId', () => {
  it('returns current selection when it still exists', () => {
    expect(resolveManagedCategoryId(categories, 'medical')).toBe('medical');
  });

  it('falls back to the first category when current selection is missing', () => {
    expect(resolveManagedCategoryId(categories, 'missing')).toBe('food');
  });

  it('returns null when no categories are available', () => {
    expect(resolveManagedCategoryId([], 'medical')).toBeNull();
  });
});

describe('buildManagedCategoryCards', () => {
  it('keeps subcategories inline only for the expanded category', () => {
    expect(buildManagedCategoryCards(categories, 'food')).toEqual([
      {
        ...categories[0],
        isExpanded: true,
        visibleSubcategories: categories[0].subcategories,
      },
      {
        ...categories[1],
        isExpanded: false,
        visibleSubcategories: [],
      },
    ]);
  });

  it('keeps all categories collapsed when no expanded id is available', () => {
    expect(buildManagedCategoryCards(categories, 'missing')).toEqual([
      {
        ...categories[0],
        isExpanded: false,
        visibleSubcategories: [],
      },
      {
        ...categories[1],
        isExpanded: false,
        visibleSubcategories: [],
      },
    ]);
  });
});

describe('resolveManagedExpandedCategoryId', () => {
  it('returns the current expanded category when it still exists', () => {
    expect(resolveManagedExpandedCategoryId(categories, 'food')).toBe('food');
  });

  it('collapses everything when the expanded category is missing', () => {
    expect(resolveManagedExpandedCategoryId(categories, 'missing')).toBeNull();
  });

  it('returns null when no categories are available', () => {
    expect(resolveManagedExpandedCategoryId([], 'food')).toBeNull();
  });
});

describe('toggleManagedExpandedCategoryId', () => {
  it('expands a collapsed category', () => {
    expect(toggleManagedExpandedCategoryId(null, 'food')).toBe('food');
  });

  it('collapses the currently expanded category when tapped again', () => {
    expect(toggleManagedExpandedCategoryId('food', 'food')).toBeNull();
  });

  it('switches expansion to the newly chosen category', () => {
    expect(toggleManagedExpandedCategoryId('food', 'medical')).toBe('medical');
  });
});
