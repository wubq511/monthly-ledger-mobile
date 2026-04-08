import { describe, expect, it } from 'vitest';

type MoveItem = <T>(items: T[], fromIndex: number, toIndex: number) => T[];
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

async function requireMoveCategoryBeforeTarget(): Promise<MoveCategoryBeforeTarget> {
  const categoryReorder = await import('./categoryReorder').catch(() => ({}));

  expect('moveCategoryBeforeTarget' in categoryReorder).toBe(true);

  return (categoryReorder as { moveCategoryBeforeTarget: MoveCategoryBeforeTarget })
    .moveCategoryBeforeTarget;
}

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
});
