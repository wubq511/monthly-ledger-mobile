import { describe, expect, it } from 'vitest';

import { getAppLoadState } from './appLoading';

describe('appLoading helpers', () => {
  it('keeps the splash screen until every data source has hydrated once', () => {
    expect(
      getAppLoadState({
        entriesReady: false,
        entriesLoading: true,
        categoriesReady: true,
        categoriesLoading: false,
        budgetReady: true,
        budgetLoading: false,
        ledgerModeReady: true,
        ledgerModeLoading: false,
      })
    ).toEqual({
      bootLoading: true,
      syncing: false,
    });
  });

  it('uses the in-app syncing overlay after initial hydration', () => {
    expect(
      getAppLoadState({
        entriesReady: true,
        entriesLoading: false,
        categoriesReady: true,
        categoriesLoading: true,
        budgetReady: true,
        budgetLoading: false,
        ledgerModeReady: true,
        ledgerModeLoading: false,
      })
    ).toEqual({
      bootLoading: false,
      syncing: true,
    });
  });

  it('stays fully interactive when all stores are ready and idle', () => {
    expect(
      getAppLoadState({
        entriesReady: true,
        entriesLoading: false,
        categoriesReady: true,
        categoriesLoading: false,
        budgetReady: true,
        budgetLoading: false,
        ledgerModeReady: true,
        ledgerModeLoading: false,
      })
    ).toEqual({
      bootLoading: false,
      syncing: false,
    });
  });
});
