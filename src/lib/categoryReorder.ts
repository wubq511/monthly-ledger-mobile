export function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    fromIndex >= items.length ||
    toIndex < 0 ||
    toIndex >= items.length
  ) {
    return items;
  }

  const nextItems = [...items];
  const [activeItem] = nextItems.splice(fromIndex, 1);

  if (activeItem === undefined) {
    return items;
  }

  nextItems.splice(toIndex, 0, activeItem);

  return nextItems;
}

export function moveCategoryBeforeTarget(
  orderedIds: string[],
  activeId: string,
  targetId: string
) {
  if (activeId === targetId) {
    return orderedIds;
  }

  const activeIndex = orderedIds.findIndex((id) => id === activeId);
  const targetIndex = orderedIds.findIndex((id) => id === targetId);

  if (activeIndex === -1 || targetIndex === -1) {
    return orderedIds;
  }

  return moveItem(orderedIds, activeIndex, targetIndex);
}
