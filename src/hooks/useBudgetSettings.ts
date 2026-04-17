import { useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import {
  clearMonthlyBudgetOverride as clearMonthlyBudgetOverrideRecord,
  getBudgetSettings,
  setDefaultBudget as setDefaultBudgetRecord,
  setMonthlyBudgetOverride as setMonthlyBudgetOverrideRecord,
} from '../lib/database';
import type { BudgetSettings } from '../types/ledger';

const EMPTY_BUDGET_SETTINGS: BudgetSettings = {
  defaultBudget: null,
  monthlyBudgets: {},
};

export function useBudgetSettings() {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<BudgetSettings>(EMPTY_BUDGET_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);

    try {
      const nextSettings = await getBudgetSettings(db);
      setSettings(nextSettings);
      setError(null);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : '读取预算设置失败';
      setError(message);
    } finally {
      setReady(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [db]);

  const runMutation = async (task: () => Promise<void>) => {
    setLoading(true);

    try {
      await task();
      await refresh();
    } catch (mutationError) {
      setLoading(false);
      throw mutationError;
    }
  };

  return {
    settings,
    loading,
    ready,
    error,
    refresh,
    setDefaultBudget: async (amount: number) => {
      await runMutation(() => setDefaultBudgetRecord(db, amount));
    },
    setMonthlyBudgetOverride: async (monthKey: string, amount: number) => {
      await runMutation(() => setMonthlyBudgetOverrideRecord(db, monthKey, amount));
    },
    clearMonthlyBudgetOverride: async (monthKey: string) => {
      await runMutation(() => clearMonthlyBudgetOverrideRecord(db, monthKey));
    },
  };
}
