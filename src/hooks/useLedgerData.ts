import { useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { deleteExpenseById, getAllExpenses, insertExpense } from '../lib/database';
import type { ExpenseDraft, ExpenseEntry } from '../types/ledger';

export function useLedgerData() {
  const db = useSQLiteContext();
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);

    try {
      const rows = await getAllExpenses(db);
      setEntries(rows);
      setError(null);
      return rows;
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : '读取账本失败';
      setError(message);
      throw fetchError instanceof Error ? fetchError : new Error(message);
    } finally {
      setReady(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh().catch(() => {
      // The hook exposes error state for initial load failures.
    });
  }, [db]);

  const addEntry = async (draft: ExpenseDraft) => {
    setLoading(true);

    try {
      await insertExpense(db, draft);
      await refresh();
    } catch (mutationError) {
      setLoading(false);
      throw mutationError;
    }
  };

  const removeEntry = async (id: string) => {
    setLoading(true);

    try {
      await deleteExpenseById(db, id);
      await refresh();
    } catch (mutationError) {
      setLoading(false);
      throw mutationError;
    }
  };

  return {
    entries,
    loading,
    ready,
    error,
    addEntry,
    removeEntry,
    refresh,
  };
}
