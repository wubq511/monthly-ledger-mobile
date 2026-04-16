# Budget Settings And Management Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable budgets with both a global default and per-month overrides, and consolidate budget settings, category management, and backup/import into a single "账本设置" entry, then install the updated Android build on the connected phone.

**Architecture:** Persist budget settings in SQLite as ledger-level configuration, expose them through a dedicated hook, and feed them into the summary layer so all budget displays derive from one source of truth. Replace the two separate management entry buttons in the add page with one unified management hub modal that hosts budget settings directly and links out to the existing category manager and backup/import flows.

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript, expo-sqlite, Vitest, existing modal/keyboard layout utilities

---

### Task 1: Persist Budget Settings In SQLite

**Files:**
- Modify: `D:/mcat/src/types/ledger.ts`
- Modify: `D:/mcat/src/lib/database.ts`
- Test: `D:/mcat/src/lib/database.test.ts`

- [ ] **Step 1: Write the failing database tests for default and monthly budgets**

```ts
it('stores and reads the default budget and monthly overrides', async () => {
  const db = new FakeDatabase([]);
  const initializeDatabase = requireDatabaseApi('initializeDatabase');
  const getBudgetSettings = requireDatabaseApi('getBudgetSettings');
  const setDefaultBudget = requireDatabaseApi('setDefaultBudget');
  const setMonthlyBudgetOverride = requireDatabaseApi('setMonthlyBudgetOverride');

  await initializeDatabase(db as never);
  await setDefaultBudget(db as never, 3200);
  await setMonthlyBudgetOverride(db as never, '2026-04', 2800);

  await expect(getBudgetSettings(db as never)).resolves.toEqual({
    defaultBudget: 3200,
    monthlyBudgets: {
      '2026-04': 2800,
    },
  });
});

it('removes a monthly override without touching the default budget', async () => {
  const db = new FakeDatabase([]);
  const initializeDatabase = requireDatabaseApi('initializeDatabase');
  const setDefaultBudget = requireDatabaseApi('setDefaultBudget');
  const setMonthlyBudgetOverride = requireDatabaseApi('setMonthlyBudgetOverride');
  const clearMonthlyBudgetOverride = requireDatabaseApi('clearMonthlyBudgetOverride');
  const getBudgetSettings = requireDatabaseApi('getBudgetSettings');

  await initializeDatabase(db as never);
  await setDefaultBudget(db as never, 2600);
  await setMonthlyBudgetOverride(db as never, '2026-05', 3000);
  await clearMonthlyBudgetOverride(db as never, '2026-05');

  await expect(getBudgetSettings(db as never)).resolves.toEqual({
    defaultBudget: 2600,
    monthlyBudgets: {},
  });
});
```

- [ ] **Step 2: Run the targeted database test to verify it fails**

Run: `npm test -- src/lib/database.test.ts`

Expected: FAIL with missing `getBudgetSettings`, `setDefaultBudget`, `setMonthlyBudgetOverride`, or `clearMonthlyBudgetOverride` exports.

- [ ] **Step 3: Extend the ledger types with budget configuration models**

```ts
export interface BudgetSettings {
  defaultBudget: number | null;
  monthlyBudgets: Record<string, number>;
}
```

Add the new interface to `D:/mcat/src/types/ledger.ts`. Keep it in the shared types file because the database layer, backup layer, hook layer, and UI all need the same shape.

- [ ] **Step 4: Add SQLite schema and database accessors for budget settings**

```ts
export async function getBudgetSettings(db: SQLiteDatabase): Promise<BudgetSettings> {
  const rows = await db.getAllAsync<BudgetSettingRow>(
    `SELECT scope, month_key, amount
     FROM budget_settings
     ORDER BY month_key ASC`
  );

  const monthlyBudgets: Record<string, number> = {};
  let defaultBudget: number | null = null;

  for (const row of rows) {
    if (row.scope === 'default') {
      defaultBudget = row.amount;
      continue;
    }

    if (row.month_key) {
      monthlyBudgets[row.month_key] = row.amount;
    }
  }

  return { defaultBudget, monthlyBudgets };
}

export async function setDefaultBudget(db: SQLiteDatabase, amount: number) {
  await db.runAsync(
    `INSERT INTO budget_settings (scope, month_key, amount, updated_at)
     VALUES ('default', '', ?, ?)
     ON CONFLICT(scope, month_key) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at`,
    [amount, new Date().toISOString()]
  );
}

export async function setMonthlyBudgetOverride(db: SQLiteDatabase, monthKey: string, amount: number) {
  await db.runAsync(
    `INSERT INTO budget_settings (scope, month_key, amount, updated_at)
     VALUES ('month', ?, ?, ?)
     ON CONFLICT(scope, month_key) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at`,
    [monthKey, amount, new Date().toISOString()]
  );
}

export async function clearMonthlyBudgetOverride(db: SQLiteDatabase, monthKey: string) {
  await db.runAsync(`DELETE FROM budget_settings WHERE scope = 'month' AND month_key = ?`, [monthKey]);
}
```

Also add this table to `initializeDatabase` in `D:/mcat/src/lib/database.ts`:

```sql
CREATE TABLE IF NOT EXISTS budget_settings (
  scope TEXT NOT NULL,
  month_key TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_settings_scope_month
ON budget_settings(scope, month_key);
```

Update the fake database in `D:/mcat/src/lib/database.test.ts` so `getAllAsync` and `runAsync` understand the new table and the new upsert/delete statements.

- [ ] **Step 5: Run the targeted database test to verify it passes**

Run: `npm test -- src/lib/database.test.ts`

Expected: PASS with the new budget persistence tests green.

- [ ] **Step 6: Commit the SQLite budget settings foundation**

```bash
git add src/types/ledger.ts src/lib/database.ts src/lib/database.test.ts
git commit -m "feat: persist configurable budget settings"
```

### Task 2: Include Budget Settings In Backup Import And Export

**Files:**
- Modify: `D:/mcat/src/types/ledger.ts`
- Modify: `D:/mcat/src/lib/backup.ts`
- Modify: `D:/mcat/src/lib/backup.test.ts`
- Modify: `D:/mcat/src/components/BackupActions.tsx`
- Modify: `D:/mcat/src/lib/database.ts`

- [ ] **Step 1: Write the failing backup tests for budget settings**

```ts
it('builds a payload that includes default and monthly budget settings', () => {
  const payload = buildBackupPayload(
    entries,
    categories,
    {
      defaultBudget: 2600,
      monthlyBudgets: { '2026-04': 3000 },
    },
    '1.0.8',
    '2026-04-16T12:00:00.000Z'
  );

  expect(payload.budgetSettings).toEqual({
    defaultBudget: 2600,
    monthlyBudgets: { '2026-04': 3000 },
  });
});

it('accepts legacy backup files without budget settings and falls back to empty config', () => {
  const parsed = parseBackupJson(
    JSON.stringify({
      schemaVersion: 2,
      appVersion: '1.0.8',
      exportedAt: '2026-04-16T12:00:00.000Z',
      entries,
      categories,
    })
  );

  expect(parsed.budgetSettings).toEqual({
    defaultBudget: null,
    monthlyBudgets: {},
  });
});
```

- [ ] **Step 2: Run the backup test file to verify it fails**

Run: `npm test -- src/lib/backup.test.ts`

Expected: FAIL because `LedgerBackupFile` and `buildBackupPayload` do not include `budgetSettings`.

- [ ] **Step 3: Extend the backup schema and parser**

```ts
export const BACKUP_SCHEMA_VERSION = 3;

export function buildBackupPayload(
  entries: ExpenseEntry[],
  categories: CategoryRecord[],
  budgetSettings: BudgetSettings,
  appVersion: string,
  exportedAt = new Date().toISOString()
): LedgerBackupFile {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion,
    exportedAt,
    entries: entries.map((entry) => ({ ...entry })),
    categories: categories.map((category) => ({
      ...category,
      subcategories: category.subcategories.map((subcategory) => ({ ...subcategory })),
    })),
    budgetSettings: {
      defaultBudget: budgetSettings.defaultBudget,
      monthlyBudgets: { ...budgetSettings.monthlyBudgets },
    },
  };
}
```

Update `parseBackupJson` so it:

- accepts `schemaVersion === 3` with `budgetSettings`
- accepts legacy `schemaVersion === 2` without `budgetSettings`
- returns `{ defaultBudget: null, monthlyBudgets: {} }` for old files

Update `LedgerBackupFile` in `D:/mcat/src/types/ledger.ts` accordingly.

- [ ] **Step 4: Wire budget settings through backup import/export actions**

In `D:/mcat/src/components/BackupActions.tsx`, change the export flow to read:

```ts
const [entries, categories, budgetSettings] = await Promise.all([
  exportAllExpenses(db),
  exportAllCategories(db),
  getBudgetSettings(db),
]);
```

and pass `budgetSettings` into `buildBackupPayload(...)`.

For import:

- on merge import, apply imported budget settings after merging categories and expenses
- on replace restore, clear and restore budget settings as part of the same restore path

Add the corresponding database helpers to `D:/mcat/src/lib/database.ts`:

```ts
export async function replaceBudgetSettings(db: SQLiteDatabase, settings: BudgetSettings) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM budget_settings');

    if (settings.defaultBudget !== null) {
      await setDefaultBudget(db, settings.defaultBudget);
    }

    for (const [monthKey, amount] of Object.entries(settings.monthlyBudgets)) {
      await setMonthlyBudgetOverride(db, monthKey, amount);
    }
  });
}
```

Use the same `replaceBudgetSettings` function for both merge-import budget replacement and full restore so there is exactly one budget restore path.

- [ ] **Step 5: Run the backup tests to verify the schema change passes**

Run: `npm test -- src/lib/backup.test.ts src/lib/database.test.ts`

Expected: PASS with new backup schema and restore behavior covered.

- [ ] **Step 6: Commit the backup schema update**

```bash
git add src/types/ledger.ts src/lib/backup.ts src/lib/backup.test.ts src/components/BackupActions.tsx src/lib/database.ts src/lib/database.test.ts
git commit -m "feat: back up and restore budget settings"
```

### Task 3: Feed Dynamic Budgets Into Ledger Summary

**Files:**
- Modify: `D:/mcat/src/lib/ledgerSummary.ts`
- Modify: `D:/mcat/src/lib/ledgerSummary.test.ts`
- Modify: `D:/mcat/src/components/BudgetPanels.tsx`
- Modify: `D:/mcat/src/components/Charts.tsx`
- Modify: `D:/mcat/App.tsx`

- [ ] **Step 1: Write the failing summary tests for default and monthly override budgets**

```ts
it('uses monthly overrides before the default budget', () => {
  const summary = buildLedgerSummary(
    entries,
    categories,
    '2026-03',
    {
      defaultBudget: 2500,
      monthlyBudgets: { '2026-03': 3000 },
    },
    (monthKey) => monthKey.slice(5)
  );

  expect(summary.selectedBudget.budgetLimit).toBe(3000);
  expect(summary.selectedBudget.overspend).toBe(0);
  expect(summary.selectedBudget.remaining).toBe(600);
});

it('uses the default budget for months without an override', () => {
  const summary = buildLedgerSummary(
    entries,
    categories,
    '2026-02',
    {
      defaultBudget: 2500,
      monthlyBudgets: { '2026-03': 3000 },
    },
    (monthKey) => monthKey.slice(5)
  );

  expect(summary.selectedBudget.budgetLimit).toBe(2500);
  expect(summary.selectedBudget.remaining).toBe(1700);
});
```

- [ ] **Step 2: Run the summary test file to verify it fails**

Run: `npm test -- src/lib/ledgerSummary.test.ts`

Expected: FAIL because `buildLedgerSummary` still accepts the old signature and `BudgetSnapshot` has no `budgetLimit`.

- [ ] **Step 3: Change the summary layer to resolve per-month budget limits**

Add these helpers to `D:/mcat/src/lib/ledgerSummary.ts`:

```ts
const FALLBACK_MONTHLY_BUDGET_LIMIT = 2000;

function resolveBudgetLimit(monthKey: string, settings: BudgetSettings) {
  return settings.monthlyBudgets[monthKey] ?? settings.defaultBudget ?? FALLBACK_MONTHLY_BUDGET_LIMIT;
}

function buildBudgetSnapshot(total: number, budgetLimit: number): BudgetSnapshot {
  const overspend = Math.max(total - budgetLimit, 0);
  const remaining = Math.max(budgetLimit - total, 0);
  const utilizationRate = budgetLimit > 0 ? total / budgetLimit : 0;

  return {
    total,
    budgetLimit,
    remaining,
    overspend,
    utilizationRate,
    isOverBudget: overspend > 0,
  };
}
```

Update the `buildLedgerSummary` signature:

```ts
export function buildLedgerSummary(
  entries: ExpenseEntry[],
  categories: CategoryRecord[],
  selectedMonth: string,
  budgetSettings: BudgetSettings,
  formatShortMonthLabel: (monthKey: string) => string
): LedgerSummary
```

Make every budget calculation route through `resolveBudgetLimit(monthKey, budgetSettings)`.

- [ ] **Step 4: Update budget presentation components to use the budget value from the summary**

In `D:/mcat/src/components/BudgetPanels.tsx`, change the meter props to only require the snapshot:

```ts
export function BudgetMeter({
  budget,
  light = false,
}: {
  budget: BudgetSnapshot;
  light?: boolean;
}) {
  const tone = getBudgetTone(budget);
  const colors = getToneColors(tone, light);

  return (
    <View style={[styles.meterWrap, light && styles.meterWrapLight]}>
      <View style={styles.meterHeader}>
        <View style={[styles.statusPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statusPillText, { color: colors.text }]}>{formatStatusText(budget)}</Text>
        </View>
        <Text style={[styles.limitText, { color: colors.muted }]}>
          预算 {formatCurrency(budget.budgetLimit)}
        </Text>
      </View>
    </View>
  );
}
```

In `D:/mcat/src/components/Charts.tsx`, keep `budgetLimit` as an explicit prop, but feed it from the dynamic selected-month budget in `App.tsx`:

```tsx
<MonthlyLineChart
  data={summary.monthlyTrend}
  budgetLimit={summary.selectedBudget.budgetLimit}
  selectedMonth={selectedMonth}
  onChangeMonth={onMonthChange}
/>
```

Also update `App.tsx` imports to remove the old `MONTHLY_BUDGET_LIMIT` constant.

- [ ] **Step 5: Run the summary and chart-adjacent test files**

Run: `npm test -- src/lib/ledgerSummary.test.ts src/lib/chartLayout.test.ts`

Expected: PASS with dynamic budget limits reflected in the summary API.

- [ ] **Step 6: Commit the dynamic summary refactor**

```bash
git add src/lib/ledgerSummary.ts src/lib/ledgerSummary.test.ts src/components/BudgetPanels.tsx src/components/Charts.tsx App.tsx
git commit -m "feat: compute summaries from configurable budgets"
```

### Task 4: Add A Budget Settings Hook And Management Hub UI

**Files:**
- Create: `D:/mcat/src/lib/budgetInput.ts`
- Create: `D:/mcat/src/hooks/useBudgetSettings.ts`
- Create: `D:/mcat/src/components/BudgetSettingsCard.tsx`
- Create: `D:/mcat/src/components/LedgerManagementHubModal.tsx`
- Modify: `D:/mcat/src/components/ExpenseForm.tsx`
- Test: `D:/mcat/src/lib/budgetInput.test.ts`

- [ ] **Step 1: Write the failing budget input helper tests**

```ts
it('parses valid budget input after trimming whitespace', () => {
  expect(parseBudgetAmountInput(' 3200 ')).toBe(3200);
});

it('rejects zero, negative, and invalid budget input', () => {
  expect(parseBudgetAmountInput('0')).toBeNull();
  expect(parseBudgetAmountInput('-20')).toBeNull();
  expect(parseBudgetAmountInput('abc')).toBeNull();
});

it('describes whether the current month uses a monthly override', () => {
  expect(
    getBudgetModeLabel('2026-04', {
      defaultBudget: 2600,
      monthlyBudgets: { '2026-04': 3000 },
    })
  ).toBe('monthly');

  expect(
    getBudgetModeLabel('2026-05', {
      defaultBudget: 2600,
      monthlyBudgets: { '2026-04': 3000 },
    })
  ).toBe('default');
});
```

- [ ] **Step 2: Run the helper test target and verify it fails**

Run: `npm test -- src/lib/budgetInput.test.ts`

Expected: FAIL because `parseBudgetAmountInput` and `getBudgetModeLabel` do not exist yet.

- [ ] **Step 3: Create budget input helpers for the UI layer**

Create `D:/mcat/src/lib/budgetInput.ts`:

```ts
import type { BudgetSettings } from '../types/ledger';

export function parseBudgetAmountInput(raw: string) {
  const normalized = Number(raw.trim());

  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }

  return normalized;
}

export function getBudgetModeLabel(monthKey: string, settings: BudgetSettings) {
  return settings.monthlyBudgets[monthKey] !== undefined ? 'monthly' : 'default';
}
```

- [ ] **Step 4: Create a dedicated budget settings hook**

Create `D:/mcat/src/hooks/useBudgetSettings.ts`:

```ts
export function useBudgetSettings() {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<BudgetSettings>({ defaultBudget: null, monthlyBudgets: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);

    try {
      setSettings(await getBudgetSettings(db));
      setError(null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '读取预算设置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [db]);

  return {
    settings,
    loading,
    error,
    refresh,
    setDefaultBudget: async (amount: number) => {
      await setDefaultBudget(db, amount);
      await refresh();
    },
    setMonthlyBudgetOverride: async (monthKey: string, amount: number) => {
      await setMonthlyBudgetOverride(db, monthKey, amount);
      await refresh();
    },
    clearMonthlyBudgetOverride: async (monthKey: string) => {
      await clearMonthlyBudgetOverride(db, monthKey);
      await refresh();
    },
  };
}
```

- [ ] **Step 5: Run the helper test and verify it passes**

Run: `npm test -- src/lib/budgetInput.test.ts`

Expected: PASS with the helper behavior locked before wiring the UI.

- [ ] **Step 6: Build the budget settings card and unified management hub**

Create `D:/mcat/src/components/BudgetSettingsCard.tsx` with:

- a summary of `默认月预算`
- the current form month's effective budget
- a press action to edit default budget
- a press action to set the current month's override
- a reset action when the current month has an override

Use a local editor state shape like:

```ts
type BudgetEditorState =
  | { mode: 'default'; title: string; initialValue: string; confirmLabel: string }
  | { mode: 'month'; monthKey: string; title: string; initialValue: string; confirmLabel: string };
```

Create `D:/mcat/src/components/LedgerManagementHubModal.tsx` to host:

- `BudgetSettingsCard` at the top
- a button row or stacked cards for `分类管理` and `备份与导入`
- the existing `CategoryManagerModal` launched from inside this modal
- the existing `BackupActions` card rendered inline in the hub

The title should be `账本设置`.

- [ ] **Step 7: Replace the two add-page entry buttons with one management hub entry**

In `D:/mcat/src/components/ExpenseForm.tsx`, replace:

```tsx
<View style={styles.managementButtons}>
  <Pressable onPress={handleOpenBackupModal} ... />
  <Pressable onPress={handleOpenCategoryModal} ... />
</View>
```

with:

```tsx
<Pressable onPress={handleOpenManagementHub} style={styles.backupEntryButton}>
  <Text style={styles.backupEntryLabel}>账本设置</Text>
  <Text style={styles.backupEntryArrow}>↗</Text>
</Pressable>
```

Add a single `managementHubVisible` boolean, and render `LedgerManagementHubModal` with the existing category and backup callbacks plus the new budget callbacks.

- [ ] **Step 8: Run the focused test set after the new UI wiring**

Run: `npm test -- src/lib/budgetInput.test.ts src/lib/database.test.ts src/lib/backup.test.ts src/lib/ledgerSummary.test.ts`

Expected: PASS, because the modal wiring should not break the data-layer tests and the budget settings behavior remains grounded in the tested helpers.

- [ ] **Step 9: Commit the management hub UI**

```bash
git add src/lib/budgetInput.ts src/lib/budgetInput.test.ts src/hooks/useBudgetSettings.ts src/components/BudgetSettingsCard.tsx src/components/LedgerManagementHubModal.tsx src/components/ExpenseForm.tsx
git commit -m "feat: add unified ledger management hub"
```

### Task 5: Wire Budgets Through App, Docs, And Device Verification

**Files:**
- Modify: `D:/mcat/App.tsx`
- Modify: `D:/mcat/README.md`

- [ ] **Step 1: Write the failing integration expectation in the summary tests**

```ts
it('surfaces the selected month budget limit for overview and trends consumers', () => {
  const summary = buildLedgerSummary(
    entries,
    categories,
    '2026-04',
    { defaultBudget: 2400, monthlyBudgets: { '2026-04': 3000 } },
    (monthKey) => monthKey.slice(5)
  );

  expect(summary.selectedBudget.budgetLimit).toBe(3000);
  expect(summary.monthlyBudgetRows.find((row) => row.monthKey === '2026-04')?.budgetLimit).toBe(3000);
});
```

- [ ] **Step 2: Run the summary test to verify the integration expectation passes**

Run: `npm test -- src/lib/ledgerSummary.test.ts`

Expected: PASS after Task 3 changes.

- [ ] **Step 3: Connect the new budget hook at the app root**

In `D:/mcat/App.tsx`:

- import and call `useBudgetSettings()`
- fold `budgetLoading` and `budgetError` into the existing app-level loading/error state
- pass `budgetSettings.settings` into `buildLedgerSummary(...)`
- pass the budget mutation callbacks down into `ExpenseForm`

Use this shape:

```ts
const {
  settings: budgetSettings,
  loading: budgetLoading,
  error: budgetError,
  refresh: refreshBudgetSettings,
  setDefaultBudget,
  setMonthlyBudgetOverride,
  clearMonthlyBudgetOverride,
} = useBudgetSettings();
```

When import completes in the add page, refresh all three stores:

```ts
await Promise.all([refresh(), refreshCategories(), refreshBudgetSettings()]);
```

- [ ] **Step 4: Update README for the new capability**

Add or revise the relevant bullets in `D:/mcat/README.md`:

```md
- 分类与账本设置
  - 通过“账本设置”统一管理预算、分类、备份与导入
  - 支持默认预算和按月单独预算
  - 预算调整后会同步更新概览页和趋势页中的预算状态与超支统计
```

- [ ] **Step 5: Run the full repository verification set**

Run:

```bash
npm test
npx tsc --noEmit
cd android
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
```

Expected:

- `npm test`: 0 failing test files
- `npx tsc --noEmit`: exit code 0
- `assembleRelease`: `BUILD SUCCESSFUL`

- [ ] **Step 6: Install the release APK on the connected phone**

Run:

```bash
adb install -r D:\mcat\android\app\build\outputs\apk\release\app-release.apk
adb shell am force-stop com.h.monthlyledger
adb shell monkey -p com.h.monthlyledger -c android.intent.category.LAUNCHER 1
adb shell dumpsys package com.h.monthlyledger | Select-String 'versionName=|versionCode=|pkgFlags='
```

Expected:

- install returns `Success`
- app launches successfully
- package info still reports a non-debuggable release package

- [ ] **Step 7: Commit the app wiring and docs**

```bash
git add App.tsx README.md
git commit -m "feat: wire configurable budgets through app summary"
```

### Task 6: Final Wrap-Up And Review

**Files:**
- Modify: any files touched above

- [ ] **Step 1: Review the final diff against the spec**

Run:

```bash
git diff --stat origin/master...HEAD
```

Expected: diff includes SQLite budget settings, backup schema update, summary refactor, management hub UI, and README updates.

- [ ] **Step 2: Re-run the exact shipping verification before claiming completion**

Run:

```bash
npm test
npx tsc --noEmit
cd android
.\gradlew.bat installRelease -PreactNativeArchitectures=arm64-v8a
adb shell dumpsys package com.h.monthlyledger | Select-String 'versionName=|versionCode=|pkgFlags='
```

Expected:

- all tests green
- TypeScript clean
- `installRelease` succeeds
- package still shows release flags without `DEBUGGABLE`

- [ ] **Step 3: Prepare the implementation branch for handoff**

```bash
git status --short
git log --oneline --decorate -5
```

Expected: clean worktree and a readable stack of commits covering database, backup, summary, UI, and app wiring.
