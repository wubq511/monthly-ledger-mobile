import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { useSQLiteContext } from 'expo-sqlite';
import * as Sharing from 'expo-sharing';

import { buildBackupPayload, createBackupFileName, parseBackupJson } from '../lib/backup';
import {
  importBackupMerge,
  exportAllCategories,
  exportAllExpenses,
  getBudgetSettings,
  restoreBackupReplace,
} from '../lib/database';
import type { LedgerMode, ParsedLedgerBackupFile } from '../types/ledger';

interface BackupActionsProps {
  ledgerMode: LedgerMode;
  onImported: () => Promise<void>;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatMergeSummary(
  importedCount: number,
  skippedCount: number,
  categories: { imported: number; skipped: number; importedSubcategories: number; skippedSubcategories: number }
) {
  return `新增 ${importedCount} 条，跳过 ${skippedCount} 条重复记录；分类新增 ${categories.imported} 个，跳过 ${categories.skipped} 个；细分新增 ${categories.importedSubcategories} 个，跳过 ${categories.skippedSubcategories} 个`;
}

function formatReplaceSummary(importedCount: number, categoryCount: number) {
  return `已清空当前账本，并恢复 ${importedCount} 条记录与 ${categoryCount} 个大类`;
}

export function BackupActions({ ledgerMode, onImported }: BackupActionsProps) {
  const db = useSQLiteContext();
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const busy = busyLabel !== null;

  const runMergeImport = async (backup: ParsedLedgerBackupFile) => {
    setBusyLabel('正在合并导入...');

    try {
      const result = await importBackupMerge(db, backup);
      await onImported();
      Alert.alert(
        '导入完成',
        formatMergeSummary(result.expenseResult.importedCount, result.expenseResult.skippedCount, {
          imported: result.categoryResult.importedCategoryCount,
          skipped: result.categoryResult.skippedCategoryCount,
          importedSubcategories: result.categoryResult.importedSubcategoryCount,
          skippedSubcategories: result.categoryResult.skippedSubcategoryCount,
        })
      );
    } catch (error) {
      Alert.alert('导入失败', getErrorMessage(error, '合并导入失败'));
    } finally {
      setBusyLabel(null);
    }
  };

  const runReplaceRestore = async (backup: ParsedLedgerBackupFile) => {
    setBusyLabel('正在覆盖恢复...');

    try {
      const result = await restoreBackupReplace(db, backup);
      await onImported();
      Alert.alert('恢复完成', formatReplaceSummary(result.expenseResult.importedCount, backup.categories.length));
    } catch (error) {
      Alert.alert('恢复失败', getErrorMessage(error, '覆盖恢复失败'));
    } finally {
      setBusyLabel(null);
    }
  };

  const handleExport = async () => {
    setBusyLabel('正在生成备份...');

    try {
      const [entries, categories, budgetSettings] = await Promise.all([
        exportAllExpenses(db),
        exportAllCategories(db),
        getBudgetSettings(db),
      ]);
      const exportedAt = new Date().toISOString();
      const payload = buildBackupPayload(
        entries,
        categories,
        budgetSettings,
        Constants.expoConfig?.version ?? 'unknown',
        exportedAt,
        ledgerMode
      );
      const directory = new Directory(Paths.cache, 'backups');
      directory.create({ idempotent: true, intermediates: true });

      const file = new File(directory, createBackupFileName(exportedAt));
      file.create({ overwrite: true, intermediates: true });
      file.write(JSON.stringify(payload, null, 2));

      if (await Sharing.isAvailableAsync()) {
        try {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'application/json',
            dialogTitle: '导出账本备份',
          });
        } catch {
          // The backup file already exists locally. Share cancellation should not mark export as failed.
        }
      }

      Alert.alert('导出完成', `备份文件已生成：${file.name}`);
    } catch (error) {
      Alert.alert('导出失败', getErrorMessage(error, '导出备份失败'));
    } finally {
      setBusyLabel(null);
    }
  };

  const handleImport = async () => {
    setBusyLabel('正在读取备份...');

    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        return;
      }

      const file = new File(result.assets[0].uri);
      const backup = parseBackupJson(await file.text());

      Alert.alert(
        '选择恢复方式',
        `检测到 ${backup.entries.length} 条记录和 ${backup.categories.length} 个大类，请选择恢复方式。`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '合并导入',
            onPress: () => {
              void runMergeImport(backup);
            },
          },
          {
            text: '覆盖恢复',
            style: 'destructive',
            onPress: () => {
              Alert.alert('覆盖当前账本？', '当前账本和分类配置会被清空，然后恢复备份中的全部内容。', [
                { text: '取消', style: 'cancel' },
                {
                  text: '确认覆盖',
                  style: 'destructive',
                  onPress: () => {
                    void runReplaceRestore(backup);
                  },
                },
              ]);
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('导入失败', getErrorMessage(error, '导入备份失败'));
    } finally {
      setBusyLabel(null);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>备份与导入</Text>

      <View style={styles.buttonGroup}>
        <Pressable
          disabled={busy}
          onPress={() => {
            void handleExport();
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            busy && styles.buttonDisabled,
            pressed && !busy && styles.buttonPressed,
          ]}>
          <Text style={styles.primaryButtonText}>
            {busyLabel === '正在生成备份...' ? '正在导出...' : '导出 JSON'}
          </Text>
        </Pressable>

        <Pressable
          disabled={busy}
          onPress={() => {
            void handleImport();
          }}
          style={({ pressed }) => [
            styles.secondaryButton,
            busy && styles.buttonDisabled,
            pressed && !busy && styles.secondaryButtonPressed,
          ]}>
          <Text style={styles.secondaryButtonText}>
            {busyLabel !== null && busyLabel !== '正在生成备份...' ? '处理中...' : '导入备份'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E4D5C8',
    backgroundColor: '#FBF7F1',
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 10,
  },
  title: {
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  buttonGroup: {
    marginTop: 4,
    gap: 10,
  },
  primaryButton: {
    borderRadius: 18,
    backgroundColor: '#231B16',
    paddingHorizontal: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9C8B8',
    backgroundColor: '#FFFDFC',
    paddingHorizontal: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  secondaryButtonPressed: {
    backgroundColor: '#F6EFE7',
  },
  primaryButtonText: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#FBF7F1',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
});
