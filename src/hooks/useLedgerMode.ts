import { useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { getLedgerMode, setLedgerMode as setLedgerModeRecord } from '../lib/database';
import type { LedgerMode } from '../types/ledger';

export function useLedgerMode() {
  const db = useSQLiteContext();
  const [mode, setMode] = useState<LedgerMode>('month');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);

    try {
      const nextMode = await getLedgerMode(db);
      setMode(nextMode);
      setError(null);
      return nextMode;
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : '读取记账模式失败';
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

  const updateMode = async (nextMode: LedgerMode) => {
    setLoading(true);

    try {
      await setLedgerModeRecord(db, nextMode);
      await refresh();
    } catch (mutationError) {
      setLoading(false);
      throw mutationError;
    }
  };

  return {
    mode,
    loading,
    ready,
    error,
    refresh,
    setMode: updateMode,
  };
}
