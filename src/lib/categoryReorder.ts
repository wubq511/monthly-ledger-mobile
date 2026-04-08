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

  const nextIds = [...orderedIds];
  const [activeItem] = nextIds.splice(activeIndex, 1);

  if (!activeItem) {
    return orderedIds;
  }

  const adjustedTargetIndex = nextIds.findIndex((id) => id === targetId);
  nextIds.splice(adjustedTargetIndex, 0, activeItem);

  return nextIds;
}
