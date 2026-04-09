import type { CategoryRecord } from '../types/ledger';

export interface ManagedCategoryCard extends CategoryRecord {
  isExpanded: boolean;
  visibleSubcategories: CategoryRecord['subcategories'];
}

export function resolveManagedCategoryId(
  categories: CategoryRecord[],
  currentCategoryId: string | null
): string | null {
  if (categories.length === 0) {
    return null;
  }

  if (currentCategoryId && categories.some((category) => category.id === currentCategoryId)) {
    return currentCategoryId;
  }

  return categories[0].id;
}

export function buildManagedCategoryCards(
  categories: CategoryRecord[],
  expandedCategoryId: string | null
): ManagedCategoryCard[] {
  const resolvedExpandedCategoryId = resolveManagedExpandedCategoryId(
    categories,
    expandedCategoryId
  );

  return categories.map((category) => {
    const isExpanded = category.id === resolvedExpandedCategoryId;

    return {
      ...category,
      isExpanded,
      visibleSubcategories: isExpanded ? category.subcategories : [],
    };
  });
}

export function resolveManagedExpandedCategoryId(
  categories: CategoryRecord[],
  expandedCategoryId: string | null
): string | null {
  if (!expandedCategoryId) {
    return null;
  }

  return categories.some((category) => category.id === expandedCategoryId)
    ? expandedCategoryId
    : null;
}

export function toggleManagedExpandedCategoryId(
  expandedCategoryId: string | null,
  nextCategoryId: string
): string | null {
  return expandedCategoryId === nextCategoryId ? null : nextCategoryId;
}
