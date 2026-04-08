import { useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import {
  createCategory as createCategoryRecord,
  createSubcategory as createSubcategoryRecord,
  deleteCategory as deleteCategoryRecord,
  deleteSubcategory as deleteSubcategoryRecord,
  getAllCategories,
  getCategoryUsageSummary,
  getSubcategoryUsageSummary,
  renameCategory as renameCategoryRecord,
  renameSubcategory as renameSubcategoryRecord,
  updateCategoryOrder,
} from '../lib/database';
import type { CategoryRecord } from '../types/ledger';

export function useCategoryData() {
  const db = useSQLiteContext();
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);

    try {
      const rows = await getAllCategories(db);
      setCategories(rows);
      setError(null);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : '读取分类失败';
      setError(message);
    } finally {
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
    categories,
    loading,
    error,
    refresh,
    createCategory: async (name: string) => {
      await runMutation(() => createCategoryRecord(db, { name }));
    },
    renameCategory: async (id: string, name: string) => {
      await runMutation(() => renameCategoryRecord(db, id, name));
    },
    deleteCategory: async (id: string) => {
      await runMutation(() => deleteCategoryRecord(db, id));
    },
    reorderCategories: async (idsInOrder: string[]) => {
      await runMutation(() => updateCategoryOrder(db, idsInOrder));
    },
    createSubcategory: async (categoryId: string, name: string) => {
      await runMutation(() => createSubcategoryRecord(db, categoryId, name));
    },
    renameSubcategory: async (id: string, name: string) => {
      await runMutation(() => renameSubcategoryRecord(db, id, name));
    },
    deleteSubcategory: async (id: string) => {
      await runMutation(() => deleteSubcategoryRecord(db, id));
    },
    getCategoryUsageSummary: async (id: string) => getCategoryUsageSummary(db, id),
    getSubcategoryUsageSummary: async (id: string) => getSubcategoryUsageSummary(db, id),
  };
}
