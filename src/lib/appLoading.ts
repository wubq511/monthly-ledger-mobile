interface AppLoadStateInput {
  entriesReady: boolean;
  entriesLoading: boolean;
  categoriesReady: boolean;
  categoriesLoading: boolean;
  budgetReady: boolean;
  budgetLoading: boolean;
  ledgerModeReady: boolean;
  ledgerModeLoading: boolean;
}

export function getAppLoadState({
  entriesReady,
  entriesLoading,
  categoriesReady,
  categoriesLoading,
  budgetReady,
  budgetLoading,
  ledgerModeReady,
  ledgerModeLoading,
}: AppLoadStateInput) {
  const bootLoading = !entriesReady || !categoriesReady || !budgetReady || !ledgerModeReady;
  const syncing =
    !bootLoading &&
    (entriesLoading || categoriesLoading || budgetLoading || ledgerModeLoading);

  return {
    bootLoading,
    syncing,
  };
}
