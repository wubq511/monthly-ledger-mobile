export interface NextCategoryStep {
  nextCategory: string | null;
  shouldReturnToOverview: boolean;
}

export function getNextCategoryStep(
  orderedCategoryNames: string[],
  categoryName: string
): NextCategoryStep {
  const currentIndex = orderedCategoryNames.findIndex((item) => item === categoryName);
  const finalIndex = orderedCategoryNames.length - 1;

  if (currentIndex === -1 || currentIndex >= finalIndex) {
    return {
      nextCategory: null,
      shouldReturnToOverview: true,
    };
  }

  return {
    nextCategory: orderedCategoryNames[currentIndex + 1] ?? null,
    shouldReturnToOverview: false,
  };
}
