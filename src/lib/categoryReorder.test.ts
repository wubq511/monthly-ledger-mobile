import { describe, expect, it } from 'vitest';

type MoveCategoryBeforeTarget = (
  orderedIds: string[],
  activeId: string,
  targetId: string
) => string[];

async function requireMoveCategoryBeforeTarget(): Promise<MoveCategoryBeforeTarget> {
  const categoryReorder = await import('./categoryReorder').catch(() => ({}));

  expect('moveCategoryBeforeTarget' in categoryReorder).toBe(true);

  return (categoryReorder as { moveCategoryBeforeTarget: MoveCategoryBeforeTarget })
    .moveCategoryBeforeTarget;
}

describe('moveCategoryBeforeTarget', () => {
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
