import { CATEGORY_DEFINITIONS } from '../constants/categories';

export interface NextCategoryStep {
  nextCategory: string | null;
  shouldReturnToOverview: boolean;
}

export function getNextCategoryStep(categoryName: string): NextCategoryStep {
  const currentIndex = CATEGORY_DEFINITIONS.findIndex((item) => item.name === categoryName);
  const finalIndex = CATEGORY_DEFINITIONS.length - 1;

  if (currentIndex === -1 || currentIndex >= finalIndex) {
    return {
      nextCategory: null,
      shouldReturnToOverview: true,
    };
  }

  return {
    nextCategory: CATEGORY_DEFINITIONS[currentIndex + 1]?.name ?? null,
    shouldReturnToOverview: false,
  };
}
