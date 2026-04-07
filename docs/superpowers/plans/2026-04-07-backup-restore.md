# Backup Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local JSON backup export plus merge import and replace restore for the monthly ledger app.

**Architecture:** Keep backup format parsing and validation in a dedicated `backup` module, keep SQLite batch import/export semantics in `database.ts`, and keep file picker/share UI in a focused `BackupActions` component rendered at the bottom of the trends screen. Use strict validation before any write, and wrap merge/replace writes in database transactions so refresh happens only after the full operation succeeds.

**Tech Stack:** Expo 54, React Native 0.81, TypeScript, expo-sqlite, expo-file-system, expo-document-picker, expo-sharing, Vitest

---

## File Structure

- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\package.json`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\package-lock.json`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\App.tsx`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\database.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\types\ledger.ts`
- Create: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\backup.ts`
- Create: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\backup.test.ts`
- Create: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\database.test.ts`
- Create: `D:\MyCode\workspace\monthly-ledger-mobile\src\components\BackupActions.tsx`

### Task 1: Add Backup Format Types and Validation

**Files:**
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\types\ledger.ts`
- Create: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\backup.ts`
- Test: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\backup.test.ts`

- [ ] **Step 1: Write the failing tests for backup payload creation and parsing**

```ts
import { describe, expect, it } from 'vitest';

import {
  BACKUP_SCHEMA_VERSION,
  buildBackupPayload,
  createBackupFileName,
  parseBackupJson,
} from './backup';
import type { ExpenseEntry } from '../types/ledger';

const entries: ExpenseEntry[] = [
  {
    id: 'entry-1',
    monthKey: '2026-04',
    amount: 25.5,
    category: '饮食',
    subcategory: '食堂',
    note: '午饭',
    createdAt: '2026-04-07T12:00:00.000Z',
  },
];

describe('backup helpers', () => {
  it('builds a schema-versioned payload with exported timestamp and entries', () => {
    const payload = buildBackupPayload(entries, '1.0.3', '2026-04-07T12:00:00.000Z');

    expect(payload).toEqual({
      schemaVersion: BACKUP_SCHEMA_VERSION,
      appVersion: '1.0.3',
      exportedAt: '2026-04-07T12:00:00.000Z',
      entries,
    });
  });

  it('parses a valid backup json document', () => {
    const parsed = parseBackupJson(
      JSON.stringify({
        schemaVersion: 1,
        appVersion: '1.0.3',
        exportedAt: '2026-04-07T12:00:00.000Z',
        entries,
      })
    );

    expect(parsed.entries[0].id).toBe('entry-1');
    expect(parsed.entries[0].monthKey).toBe('2026-04');
  });

  it('rejects malformed backup documents', () => {
    expect(() =>
      parseBackupJson(
        JSON.stringify({
          schemaVersion: 1,
          appVersion: '1.0.3',
          exportedAt: '2026-04-07T12:00:00.000Z',
          entries: [{ ...entries[0], monthKey: '2026-13' }],
        })
      )
    ).toThrow('备份文件格式不合法');
  });

  it('generates a date-based file name', () => {
    expect(createBackupFileName('2026-04-07T12:00:00.000Z')).toBe(
      'monthly-ledger-backup-2026-04-07.json'
    );
  });
});
```

- [ ] **Step 2: Run the backup test file and verify it fails for missing exports**

Run: `npx vitest run src/lib/backup.test.ts`

Expected: FAIL with errors such as `Cannot find module './backup'` or missing exported members.

- [ ] **Step 3: Add backup-related types**

```ts
export interface LedgerBackupFile {
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  entries: ExpenseEntry[];
}

export interface ImportExpensesResult {
  importedCount: number;
  skippedCount: number;
}
```

- [ ] **Step 4: Implement strict backup payload creation and validation**

```ts
import { isValidMonthInput } from './date';
import type { ExpenseEntry, LedgerBackupFile } from '../types/ledger';

export const BACKUP_SCHEMA_VERSION = 1;

export function buildBackupPayload(
  entries: ExpenseEntry[],
  appVersion: string,
  exportedAt = new Date().toISOString()
): LedgerBackupFile {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion,
    exportedAt,
    entries: entries.map((entry) => ({ ...entry })),
  };
}

export function createBackupFileName(exportedAt: string) {
  return `monthly-ledger-backup-${exportedAt.slice(0, 10)}.json`;
}

export function parseBackupJson(raw: string): LedgerBackupFile {
  const parsed = JSON.parse(raw);

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    parsed.schemaVersion !== BACKUP_SCHEMA_VERSION ||
    !Array.isArray(parsed.entries)
  ) {
    throw new Error('备份文件格式不合法');
  }

  const entries = parsed.entries.map(assertExpenseEntry);

  if (typeof parsed.appVersion !== 'string' || typeof parsed.exportedAt !== 'string') {
    throw new Error('备份文件格式不合法');
  }

  return {
    schemaVersion: parsed.schemaVersion,
    appVersion: parsed.appVersion,
    exportedAt: parsed.exportedAt,
    entries,
  };
}

function assertExpenseEntry(value: unknown): ExpenseEntry {
  if (!value || typeof value !== 'object') {
    throw new Error('备份文件格式不合法');
  }

  const entry = value as Record<string, unknown>;

  if (
    typeof entry.id !== 'string' ||
    !entry.id.trim() ||
    typeof entry.monthKey !== 'string' ||
    !isValidMonthInput(entry.monthKey) ||
    typeof entry.amount !== 'number' ||
    !Number.isFinite(entry.amount) ||
    entry.amount <= 0 ||
    typeof entry.category !== 'string' ||
    !entry.category.trim() ||
    (entry.subcategory !== null && typeof entry.subcategory !== 'string') ||
    (entry.note !== null && typeof entry.note !== 'string') ||
    typeof entry.createdAt !== 'string'
  ) {
    throw new Error('备份文件格式不合法');
  }

  return {
    id: entry.id,
    monthKey: entry.monthKey,
    amount: entry.amount,
    category: entry.category,
    subcategory: (entry.subcategory ?? null) as string | null,
    note: (entry.note ?? null) as string | null,
    createdAt: entry.createdAt,
  };
}
```

- [ ] **Step 5: Run the backup tests and verify they pass**

Run: `npx vitest run src/lib/backup.test.ts`

Expected: PASS with `4 passed`.

- [ ] **Step 6: Commit the backup format layer**

```bash
git add src/types/ledger.ts src/lib/backup.ts src/lib/backup.test.ts
git commit -m "feat: add backup format validation"
```

### Task 2: Add SQLite Export and Import Semantics

**Files:**
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\database.ts`
- Test: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\database.test.ts`

- [ ] **Step 1: Write the failing tests for merge import and replace restore**

```ts
import { describe, expect, it } from 'vitest';

import {
  clearAllExpenses,
  exportAllExpenses,
  importExpensesMerge,
  replaceAllExpenses,
} from './database';
import type { ExpenseEntry } from '../types/ledger';

class FakeDatabase {
  rows: ExpenseEntry[];

  constructor(rows: ExpenseEntry[]) {
    this.rows = [...rows];
  }

  async getAllAsync() {
    return this.rows.map((row) => ({
      id: row.id,
      month_key: row.monthKey,
      amount: row.amount,
      category: row.category,
      subcategory: row.subcategory,
      note: row.note,
      created_at: row.createdAt,
    }));
  }

  async runAsync(sql: string, params: unknown[]) {
    if (sql.startsWith('DELETE FROM expenses WHERE id = ?')) {
      this.rows = this.rows.filter((row) => row.id !== params[0]);
      return;
    }

    if (sql.startsWith('DELETE FROM expenses')) {
      this.rows = [];
      return;
    }

    if (sql.startsWith('INSERT INTO expenses')) {
      this.rows.push({
        id: params[0] as string,
        monthKey: params[2] as string,
        amount: params[3] as number,
        category: params[4] as string,
        subcategory: (params[5] as string | null) ?? null,
        note: (params[6] as string | null) ?? null,
        createdAt: params[7] as string,
      });
    }
  }

  async withTransactionAsync(task: () => Promise<void>) {
    await task();
  }
}

const existing: ExpenseEntry[] = [
  {
    id: 'existing-1',
    monthKey: '2026-04',
    amount: 66,
    category: '饮食',
    subcategory: '食堂',
    note: null,
    createdAt: '2026-04-01T00:00:00.000Z',
  },
];

const incoming: ExpenseEntry[] = [
  existing[0],
  {
    id: 'incoming-2',
    monthKey: '2026-05',
    amount: 88,
    category: '交通',
    subcategory: null,
    note: '打车',
    createdAt: '2026-05-01T00:00:00.000Z',
  },
];

describe('database backup operations', () => {
  it('exports all expenses as ledger entries', async () => {
    const db = new FakeDatabase(existing);

    await expect(exportAllExpenses(db as never)).resolves.toEqual(existing);
  });

  it('merges only non-duplicate ids', async () => {
    const db = new FakeDatabase(existing);

    await expect(importExpensesMerge(db as never, incoming)).resolves.toEqual({
      importedCount: 1,
      skippedCount: 1,
    });

    expect(db.rows.map((row) => row.id)).toEqual(['existing-1', 'incoming-2']);
  });

  it('replaces all current rows before restoring incoming data', async () => {
    const db = new FakeDatabase(existing);

    await expect(replaceAllExpenses(db as never, incoming)).resolves.toEqual({
      importedCount: 2,
      skippedCount: 0,
    });

    expect(db.rows.map((row) => row.id)).toEqual(['existing-1', 'incoming-2']);
  });

  it('clears all expenses', async () => {
    const db = new FakeDatabase(existing);

    await clearAllExpenses(db as never);

    expect(db.rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the database tests and verify they fail for missing exports**

Run: `npx vitest run src/lib/database.test.ts`

Expected: FAIL with missing functions such as `exportAllExpenses` or `importExpensesMerge`.

- [ ] **Step 3: Implement export, merge import, clear, and replace in the database layer**

```ts
export async function exportAllExpenses(db: SQLiteDatabase) {
  return getAllExpenses(db);
}

export async function clearAllExpenses(db: SQLiteDatabase) {
  await db.runAsync('DELETE FROM expenses');
}

export async function importExpensesMerge(db: SQLiteDatabase, entries: ExpenseEntry[]) {
  return db.withTransactionAsync(async () => {
    const existingRows = await getAllExpenses(db);
    const existingIds = new Set(existingRows.map((entry) => entry.id));
    const rowsToInsert = entries.filter((entry) => !existingIds.has(entry.id));

    for (const entry of rowsToInsert) {
      await insertImportedExpense(db, entry);
    }

    return {
      importedCount: rowsToInsert.length,
      skippedCount: entries.length - rowsToInsert.length,
    };
  });
}

export async function replaceAllExpenses(db: SQLiteDatabase, entries: ExpenseEntry[]) {
  return db.withTransactionAsync(async () => {
    await clearAllExpenses(db);

    for (const entry of entries) {
      await insertImportedExpense(db, entry);
    }

    return {
      importedCount: entries.length,
      skippedCount: 0,
    };
  });
}

async function insertImportedExpense(db: SQLiteDatabase, entry: ExpenseEntry) {
  await db.runAsync(
    `INSERT INTO expenses (id, date, month_key, amount, category, subcategory, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      `${entry.monthKey}-01`,
      entry.monthKey,
      entry.amount,
      entry.category,
      entry.subcategory,
      entry.note,
      entry.createdAt,
    ]
  );
}
```

- [ ] **Step 4: Run the backup and database tests together**

Run: `npx vitest run src/lib/backup.test.ts src/lib/database.test.ts`

Expected: PASS with `8 passed`.

- [ ] **Step 5: Commit the data layer changes**

```bash
git add src/lib/database.ts src/lib/database.test.ts
git commit -m "feat: add backup database import and replace flows"
```

### Task 3: Install Expo File Modules and Build the Backup UI

**Files:**
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\package.json`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\package-lock.json`
- Create: `D:\MyCode\workspace\monthly-ledger-mobile\src\components\BackupActions.tsx`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\App.tsx`

- [ ] **Step 1: Install the Expo modules required for file export, import, and sharing**

Run: `npx expo install expo-document-picker expo-file-system expo-sharing`

Expected: `package.json` and `package-lock.json` updated with SDK-compatible versions.

- [ ] **Step 2: Create the backup actions component**

```tsx
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { useSQLiteContext } from 'expo-sqlite';
import * as Sharing from 'expo-sharing';

import { buildBackupPayload, createBackupFileName, parseBackupJson } from '../lib/backup';
import { exportAllExpenses, importExpensesMerge, replaceAllExpenses } from '../lib/database';

export function BackupActions({ onImported }: { onImported: () => Promise<void> }) {
  const db = useSQLiteContext();
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);

    try {
      const entries = await exportAllExpenses(db);
      const exportedAt = new Date().toISOString();
      const payload = buildBackupPayload(
        entries,
        Constants.expoConfig?.version ?? 'unknown',
        exportedAt
      );
      const directory = new Directory(Paths.cache, 'backups');
      directory.create({ idempotent: true, intermediates: true });

      const file = new File(directory, createBackupFileName(exportedAt));
      file.create({ overwrite: true, intermediates: true });
      file.write(JSON.stringify(payload, null, 2));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: '导出账本备份',
        });
      } else {
        Alert.alert('导出完成', `备份文件已生成：${file.name}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '导出备份失败';
      Alert.alert('导出失败', message);
    } finally {
      setBusy(false);
    }
  };

  const handleImportPress = async () => {
    setBusy(true);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: 'application/json',
      });

      if (result.canceled) {
        return;
      }

      const file = new File(result.assets[0]);
      const backup = parseBackupJson(await file.text());

      Alert.alert('选择恢复方式', `检测到 ${backup.entries.length} 条记录`, [
        { text: '取消', style: 'cancel' },
        {
          text: '合并导入',
          onPress: () => {
            void runMergeImport(backup.entries);
          },
        },
        {
          text: '覆盖恢复',
          style: 'destructive',
          onPress: () => {
            Alert.alert('覆盖当前账本？', '当前账本会被清空，然后恢复备份中的全部记录。', [
              { text: '取消', style: 'cancel' },
              {
                text: '确认覆盖',
                style: 'destructive',
                onPress: () => {
                  void runReplaceRestore(backup.entries);
                },
              },
            ]);
          },
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入备份失败';
      Alert.alert('导入失败', message);
    } finally {
      setBusy(false);
    }
  };

  const runMergeImport = async (entries: ExpenseEntry[]) => {
    const result = await importExpensesMerge(db, entries);
    await onImported();
    Alert.alert('导入完成', `新增 ${result.importedCount} 条，跳过 ${result.skippedCount} 条重复记录`);
  };

  const runReplaceRestore = async (entries: ExpenseEntry[]) => {
    const result = await replaceAllExpenses(db, entries);
    await onImported();
    Alert.alert('恢复完成', `已清空当前账本，并恢复 ${result.importedCount} 条记录`);
  };

  return (
    <View>
      <Text>数据管理</Text>
      <Pressable disabled={busy} onPress={() => void handleExport()}>
        <Text>{busy ? '处理中...' : '导出备份'}</Text>
      </Pressable>
      <Pressable disabled={busy} onPress={() => void handleImportPress()}>
        <Text>{busy ? '处理中...' : '导入备份'}</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 3: Render backup actions at the bottom of the trends screen**

```tsx
function LedgerApp() {
  const { entries, loading, error, addEntry, removeEntry, refresh } = useLedgerData();

  // ...

  {activeTab === 'trends' ? (
    <TrendsScreen
      selectedMonth={selectedMonth}
      onMonthChange={setSelectedMonth}
      summary={summary}
      rankingCategories={rankingCategories}
      selectedRankingCategory={selectedRankingCategory}
      onSelectRankingCategory={setSelectedRankingCategory}
      onDataImported={refresh}
    />
  ) : null}
}

function TrendsScreen({
  selectedMonth,
  onMonthChange,
  summary,
  rankingCategories,
  selectedRankingCategory,
  onSelectRankingCategory,
  onDataImported,
}: {
  selectedMonth: string;
  onMonthChange: (monthKey: string) => void;
  summary: LedgerSummary;
  rankingCategories: string[];
  selectedRankingCategory: string | null;
  onSelectRankingCategory: (category: string) => void;
  onDataImported: () => Promise<void>;
}) {
  return (
    <ScrollView>
      <View style={styles.section}>
        <MonthSwitcher monthKey={selectedMonth} onChange={onMonthChange} />
      </View>
      <OverspendRankingList rows={summary.overspendRanking} />
      <BudgetMonthStatusList rows={summary.monthlyBudgetRows} />
      <CategoryMonthRankingCard
        selectedCategory={selectedRankingCategory}
        categories={rankingCategories}
        rankingMap={summary.categoryMonthRanking}
        onSelectCategory={onSelectRankingCategory}
      />
      <View style={styles.section}>
        <BackupActions onImported={onDataImported} />
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 4: Add styles that match the existing trends screen cards**

```ts
backupCard: {
  borderRadius: 28,
  padding: 20,
  backgroundColor: '#FFF8F2',
  borderWidth: 1,
  borderColor: '#E8D7C8',
  gap: 12,
},
backupButton: {
  borderRadius: 18,
  paddingVertical: 14,
  paddingHorizontal: 16,
  backgroundColor: '#1F1A17',
},
backupButtonSecondary: {
  backgroundColor: '#F1E6DB',
},
backupButtonText: {
  color: '#FFF8F2',
  fontFamily: 'SpaceGrotesk_700Bold',
},
backupButtonTextSecondary: {
  color: '#1F1A17',
},
```

- [ ] **Step 5: Run the full unit test suite**

Run: `npm test`

Expected: PASS with all `src/**/*.test.ts` green.

- [ ] **Step 6: Commit the UI and dependency changes**

```bash
git add package.json package-lock.json App.tsx src/components/BackupActions.tsx
git commit -m "feat: add local backup and restore actions"
```

### Task 4: Verify the Full Backup and Restore Flow

**Files:**
- Verify: `D:\MyCode\workspace\monthly-ledger-mobile\App.tsx`
- Verify: `D:\MyCode\workspace\monthly-ledger-mobile\src\components\BackupActions.tsx`
- Verify: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\backup.ts`
- Verify: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\database.ts`

- [ ] **Step 1: Re-run the full automated test suite from a clean state**

Run: `npm test`

Expected: PASS with zero failed tests.

- [ ] **Step 2: Start the Expo app for manual verification**

Run: `npm run android`

Expected: App launches on device or emulator without type or bundling errors.

- [ ] **Step 3: Manually verify export behavior**

Checklist:
- Open the `趋势` tab.
- Scroll to the `数据管理` section.
- Tap `导出备份`.
- Confirm a share sheet opens or a success alert shows when sharing is unavailable.
- Confirm the generated file name is `monthly-ledger-backup-YYYY-MM-DD.json`.

- [ ] **Step 4: Manually verify merge import behavior**

Checklist:
- Export a backup from a ledger with known rows.
- Add one new expense after exporting.
- Import the earlier backup with `合并导入`.
- Confirm the app reports imported and skipped counts.
- Confirm the newer local row still exists.

- [ ] **Step 5: Manually verify replace restore behavior**

Checklist:
- Import the same backup with `覆盖恢复`.
- Confirm the destructive confirmation dialog appears.
- Confirm current rows are replaced by the backup contents.
- Confirm the overview and trends screens reflect the restored dataset immediately after refresh.

- [ ] **Step 6: Commit final polish if manual verification required adjustments**

```bash
git add App.tsx src/components/BackupActions.tsx src/lib/backup.ts src/lib/database.ts
git commit -m "fix: polish backup restore flow"
```
