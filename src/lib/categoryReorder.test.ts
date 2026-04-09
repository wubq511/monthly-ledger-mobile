import { describe, expect, it } from 'vitest';
import type { CategoryRecord } from '../types/ledger';

type MoveItem = <T>(items: T[], fromIndex: number, toIndex: number) => T[];
type ReorderCategoriesTree = (
  categories: CategoryRecord[],
  fromIndex: number,
  toIndex: number
) => CategoryRecord[];
type ReorderSubcategoriesTree = (
  categories: CategoryRecord[],
  categoryId: string,
  fromIndex: number,
  toIndex: number
) => CategoryRecord[];
type MoveCategoryBeforeTarget = (
  orderedIds: string[],
  activeId: string,
  targetId: string
) => string[];

async function requireMoveItem(): Promise<MoveItem> {
  const categoryReorder = await import('./categoryReorder').catch(() => ({}));

  expect('moveItem' in categoryReorder).toBe(true);

  return (categoryReorder as { moveItem: MoveItem }).moveItem;
}

async function requireReorderCategoriesTree(): Promise<ReorderCategoriesTree> {
  const categoryReorder = await import('./categoryReorder').catch(() => ({}));

  expect('reorderCategoriesTree' in categoryReorder).toBe(true);

  return (categoryReorder as { reorderCategoriesTree: ReorderCategoriesTree }).reorderCategoriesTree;
}

async function requireReorderSubcategoriesTree(): Promise<ReorderSubcategoriesTree> {
  const categoryReorder = await import('./categoryReorder').catch(() => ({}));

  expect('reorderSubcategoriesTree' in categoryReorder).toBe(true);

  return (categoryReorder as { reorderSubcategoriesTree: ReorderSubcategoriesTree })
    .reorderSubcategoriesTree;
}

async function requireMoveCategoryBeforeTarget(): Promise<MoveCategoryBeforeTarget> {
  const categoryReorder = await import('./categoryReorder').catch(() => ({}));

  expect('moveCategoryBeforeTarget' in categoryReorder).toBe(true);

  return (categoryReorder as { moveCategoryBeforeTarget: MoveCategoryBeforeTarget })
    .moveCategoryBeforeTarget;
}

const categoriesTree: CategoryRecord[] = [
  {
    id: 'food',
    name: '饮食',
    color: '#E07A5F',
    sortOrder: 0,
    createdAt: '2026-04-09T00:00:00.000Z',
    updatedAt: '2026-04-09T00:00:00.000Z',
    subcategories: [
      {
        id: 'canteen',
        categoryId: 'food',
        name: '食堂',
        sortOrder: 0,
        createdAt: '2026-04-09T00:00:00.000Z',
        updatedAt: '2026-04-09T00:00:00.000Z',
      },
      {
        id: 'takeout',
        categoryId: 'food',
        name: '外卖',
        sortOrder: 1,
        createdAt: '2026-04-09T00:00:00.000Z',
        updatedAt: '2026-04-09T00:00:00.000Z',
      },
    ],
  },
  {
    id: 'traffic',
    name: '交通',
    color: '#81B29A',
    sortOrder: 1,
    createdAt: '2026-04-09T00:00:00.000Z',
    updatedAt: '2026-04-09T00:00:00.000Z',
    subcategories: [
      {
        id: 'subway',
        categoryId: 'traffic',
        name: '地铁',
        sortOrder: 0,
        createdAt: '2026-04-09T00:00:00.000Z',
        updatedAt: '2026-04-09T00:00:00.000Z',
      },
    ],
  },
  {
    id: 'other',
    name: '其他',
    color: '#3D405B',
    sortOrder: 2,
    createdAt: '2026-04-09T00:00:00.000Z',
    updatedAt: '2026-04-09T00:00:00.000Z',
    subcategories: [],
  },
];

describe('moveCategoryBeforeTarget', () => {
  it('moves an item from the middle to the front', async () => {
    const moveItem = await requireMoveItem();

    expect(moveItem(['饮食', '医疗', '交通', '其他'], 2, 0)).toEqual([
      '交通',
      '饮食',
      '医疗',
      '其他',
    ]);
  });

  it('moves an item from the front to the end', async () => {
    const moveItem = await requireMoveItem();

    expect(moveItem(['饮食', '医疗', '交通'], 0, 2)).toEqual(['医疗', '交通', '饮食']);
  });

  it('moves the selected category before the target category', async () => {
    const moveCategoryBeforeTarget = await requireMoveCategoryBeforeTarget();

    expect(moveCategoryBeforeTarget(['饮食', '医疗', '交通', '其他'], '交通', '医疗')).toEqual([
      '饮食',
      '交通',
      '医疗',
      '其他',
    ]);
  });

  it('keeps the order unchanged when the selected item is already the target', async () => {
    const moveCategoryBeforeTarget = await requireMoveCategoryBeforeTarget();

    expect(moveCategoryBeforeTarget(['饮食', '医疗', '交通'], '医疗', '医疗')).toEqual([
      '饮食',
      '医疗',
      '交通',
    ]);
  });

  it('reorders the category tree by drag indexes', async () => {
    const reorderCategoriesTree = await requireReorderCategoriesTree();

    expect(reorderCategoriesTree(categoriesTree, 2, 0).map((item) => item.id)).toEqual([
      'other',
      'food',
      'traffic',
    ]);
  });

  it('reorders subcategories only within the selected category', async () => {
    const reorderSubcategoriesTree = await requireReorderSubcategoriesTree();

    const nextTree = reorderSubcategoriesTree(categoriesTree, 'food', 1, 0);

    expect(nextTree[0]?.subcategories.map((item) => item.id)).toEqual(['takeout', 'canteen']);
    expect(nextTree[1]?.subcategories.map((item) => item.id)).toEqual(['subway']);
  });
});
