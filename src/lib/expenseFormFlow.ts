import { getMonthKeyFromDateKey } from './date';
import type { CategoryRecord, LedgerMode } from '../types/ledger';

export interface NextCategoryStep {
  nextCategory: string | null;
  nextSubcategory: string | null;
  shouldReturnToOverview: boolean;
}

export interface PeriodDraftSyncInput {
  previousLedgerMode: LedgerMode;
  ledgerMode: LedgerMode;
  monthKey: string;
  dateKey: string;
}

export type PeriodDraftSyncAction = { monthKey: string } | { dateKey: string } | null;

export function getPeriodDraftSyncAction({
  previousLedgerMode,
  ledgerMode,
  monthKey,
  dateKey,
}: PeriodDraftSyncInput): PeriodDraftSyncAction {
  if (previousLedgerMode === ledgerMode) {
    return null;
  }

  if (ledgerMode === 'day') {
    return { dateKey: `${monthKey}-01` };
  }

  return { monthKey: getMonthKeyFromDateKey(dateKey) };
}

export function getNextCategoryStep(
  categories: Pick<CategoryRecord, 'name' | 'subcategories'>[],
  categoryName: string,
  subcategoryName: string | null
): NextCategoryStep {
  const currentIndex = categories.findIndex((item) => item.name === categoryName);

  if (currentIndex === -1) {
    return {
      nextCategory: null,
      nextSubcategory: null,
      shouldReturnToOverview: true,
    };
  }

  const currentCategory = categories[currentIndex];

  if (!currentCategory) {
    return {
      nextCategory: null,
      nextSubcategory: null,
      shouldReturnToOverview: true,
    };
  }

  const currentSubcategoryIndex = currentCategory.subcategories.findIndex(
    (item) => item.name === subcategoryName
  );

  if (
    currentSubcategoryIndex !== -1 &&
    currentSubcategoryIndex < currentCategory.subcategories.length - 1
  ) {
    return {
      nextCategory: currentCategory.name,
      nextSubcategory: currentCategory.subcategories[currentSubcategoryIndex + 1]?.name ?? null,
      shouldReturnToOverview: false,
    };
  }

  const finalIndex = categories.length - 1;
  const nextCategory = categories[currentIndex + 1];

  if (!nextCategory) {
    return {
      nextCategory: null,
      nextSubcategory: null,
      shouldReturnToOverview: true,
    };
  }

  return {
    nextCategory: nextCategory.name,
    nextSubcategory: nextCategory.subcategories[0]?.name ?? null,
    shouldReturnToOverview: false,
  };
}
