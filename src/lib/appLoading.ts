interface AppLoadStateInput {
  entriesReady: boolean;
  entriesLoading: boolean;
  categoriesReady: boolean;
  categoriesLoading: boolean;
  budgetReady: boolean;
  budgetLoading: boolean;
}

export function getAppLoadState({
  entriesReady,
  entriesLoading,
  categoriesReady,
  categoriesLoading,
  budgetReady,
  budgetLoading,
}: AppLoadStateInput) {
  const bootLoading = !entriesReady || !categoriesReady || !budgetReady;
  const syncing = !bootLoading && (entriesLoading || categoriesLoading || budgetLoading);

  return {
    bootLoading,
    syncing,
  };
}
