# Budget Ranking UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 2000 CNY monthly budget layer, month-level overspend analytics, month/category rankings, and refined mobile UI while keeping the ledger month-based and locally stored.

**Architecture:** Keep SQLite and the month-based expense model unchanged. Extend the pure `ledgerSummary` aggregation to compute budget snapshots and ranking indexes in one pass, then feed those results into smaller presentation components plus upgraded charts so overview and trends stay consistent.

**Tech Stack:** Expo, React Native, TypeScript, react-native-svg, expo-sqlite, Vitest for pure aggregation tests

---

### Task 1: Add a test harness for summary logic

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/ledgerSummary.test.ts`

- [ ] **Step 1: Write the failing test file**

```ts
import { describe, expect, it } from 'vitest';
import { buildLedgerSummary, MONTHLY_BUDGET_LIMIT } from './ledgerSummary';
import type { ExpenseEntry } from '../types/ledger';

const entries: ExpenseEntry[] = [
  {
    id: '1',
    monthKey: '2026-01',
    amount: 1200,
    category: '饮食',
    subcategory: '外卖',
    note: null,
    createdAt: '2026-01-03T00:00:00.000Z',
  },
  {
    id: '2',
    monthKey: '2026-01',
    amount: 950,
    category: '娱乐',
    subcategory: null,
    note: null,
    createdAt: '2026-01-12T00:00:00.000Z',
  },
  {
    id: '3',
    monthKey: '2026-02',
    amount: 600,
    category: '饮食',
    subcategory: '食堂',
    note: null,
    createdAt: '2026-02-02T00:00:00.000Z',
  },
  {
    id: '4',
    monthKey: '2026-02',
    amount: 200,
    category: '交通',
    subcategory: null,
    note: null,
    createdAt: '2026-02-11T00:00:00.000Z',
  },
  {
    id: '5',
    monthKey: '2026-03',
    amount: 1500,
    category: '饮食',
    subcategory: '零食/水果/面包',
    note: null,
    createdAt: '2026-03-05T00:00:00.000Z',
  },
  {
    id: '6',
    monthKey: '2026-03',
    amount: 900,
    category: '交通',
    subcategory: null,
    note: null,
    createdAt: '2026-03-08T00:00:00.000Z',
  },
];

describe('buildLedgerSummary', () => {
  it('computes month budget snapshots and overall overspend stats', () => {
    const summary = buildLedgerSummary(entries, '2026-03', (monthKey) => monthKey.slice(5));

    expect(MONTHLY_BUDGET_LIMIT).toBe(2000);
    expect(summary.trackedMonthCount).toBe(3);
    expect(summary.totalOverspend).toBe(550);
    expect(summary.averageMonthlyOverspend).toBeCloseTo(550 / 3, 2);
    expect(summary.overspendMonthCount).toBe(2);
    expect(summary.selectedBudget.remaining).toBe(0);
    expect(summary.selectedBudget.overspend).toBe(400);
    expect(summary.selectedBudget.utilizationRate).toBeCloseTo(1.2, 2);
  });

  it('orders selected month category ranking and per-category month ranking', () => {
    const summary = buildLedgerSummary(entries, '2026-03', (monthKey) => monthKey.slice(5));

    expect(summary.categoryTotals.map((item) => item.name)).toEqual(['饮食', '交通']);
    expect(summary.selectedMonthRanking.map((item) => item.name)).toEqual(['饮食', '交通']);
    expect(summary.categoryMonthRanking['饮食'].map((item) => item.monthKey)).toEqual([
      '2026-03',
      '2026-01',
      '2026-02',
    ]);
    expect(summary.categoryMonthRanking['交通'].map((item) => item.monthKey)).toEqual([
      '2026-03',
      '2026-02',
    ]);
  });

  it('keeps zero-overspend months at zero and supports empty data', () => {
    const empty = buildLedgerSummary([], '2026-03', (monthKey) => monthKey.slice(5));
    const january = buildLedgerSummary(entries, '2026-02', (monthKey) => monthKey.slice(5));

    expect(empty.totalOverspend).toBe(0);
    expect(empty.averageMonthlyOverspend).toBe(0);
    expect(empty.selectedMonthRanking).toEqual([]);
    expect(january.selectedBudget.overspend).toBe(0);
    expect(january.selectedBudget.remaining).toBe(MONTHLY_BUDGET_LIMIT - 800);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ledgerSummary.test.ts`
Expected: FAIL because `vitest` and the new summary exports do not exist yet.

- [ ] **Step 3: Add the minimal test tooling**

```json
{
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^2.1.5"
  }
}
```

- [ ] **Step 4: Run the test again to verify it still fails for the right reason**

Run: `npx vitest run src/lib/ledgerSummary.test.ts`
Expected: FAIL on missing exports or wrong summary shape, not on missing executable.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/ledgerSummary.test.ts
git commit -m "test: add ledger summary regression coverage"
```

### Task 2: Implement budget and ranking aggregation

**Files:**
- Modify: `src/lib/ledgerSummary.ts`
- Modify: `src/types/ledger.ts`
- Test: `src/lib/ledgerSummary.test.ts`

- [ ] **Step 1: Write the failing test for the first new field**

Use the existing first test and focus on:

```ts
expect(summary.totalOverspend).toBe(550);
expect(summary.averageMonthlyOverspend).toBeCloseTo(550 / 3, 2);
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `npx vitest run src/lib/ledgerSummary.test.ts -t "computes month budget snapshots and overall overspend stats"`
Expected: FAIL because those fields are missing or incorrect.

- [ ] **Step 3: Write the minimal implementation**

Key additions:

```ts
export const MONTHLY_BUDGET_LIMIT = 2000;

export interface BudgetSnapshot {
  total: number;
  remaining: number;
  overspend: number;
  utilizationRate: number;
  isOverBudget: boolean;
}

export interface RankedCategoryTotal extends CategoryTotal {
  ratio: number;
}

export interface CategoryMonthRankItem {
  monthKey: string;
  label: string;
  total: number;
}
```

Implementation requirements:
- build month totals and month-category totals in one traversal
- compute `totalOverspend`, `averageMonthlyOverspend`, `overspendMonthCount`
- compute `selectedBudget`
- produce `selectedMonthRanking`
- produce `categoryMonthRanking`
- keep existing `monthlyTrend` and `peakMonth`

- [ ] **Step 4: Run all summary tests to verify they pass**

Run: `npx vitest run src/lib/ledgerSummary.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ledgerSummary.ts src/types/ledger.ts src/lib/ledgerSummary.test.ts
git commit -m "feat: add budget and ranking summary data"
```

### Task 3: Upgrade charts for budget-aware trends

**Files:**
- Modify: `src/components/Charts.tsx`

- [ ] **Step 1: Write the failing testable contract in code usage**

Plan for these prop additions:

```ts
interface MonthlyLineChartProps {
  data: TrendDatum[];
  budgetLimit: number;
}

interface MonthlyBarChartProps {
  data: TrendDatum[];
  budgetLimit: number;
}
```

- [ ] **Step 2: Run typecheck to verify current usage fails after App wiring changes**

Run: `npx tsc --noEmit`
Expected: FAIL once the new props are introduced but not yet supplied everywhere.

- [ ] **Step 3: Implement the minimal chart changes**

Required behavior:
- draw a horizontal budget line at `budgetLimit`
- label it `预算 2000`
- color over-budget bars with the warning color
- keep empty-state behavior intact

Core rendering shape:

```ts
const scaleMax = Math.max(maxValue, budgetLimit, 0);
const budgetY = CHART_PADDING + innerHeight - (budgetLimit / scaleMax) * innerHeight;
```

- [ ] **Step 4: Run typecheck to verify charts compile**

Run: `npx tsc --noEmit`
Expected: PASS for chart-level changes

- [ ] **Step 5: Commit**

```bash
git add src/components/Charts.tsx
git commit -m "feat: add budget indicators to charts"
```

### Task 4: Refine overview UI with budget status and month ranking

**Files:**
- Modify: `App.tsx`
- Create: `src/components/BudgetPanels.tsx`
- Create: `src/components/RankingLists.tsx`

- [ ] **Step 1: Write the failing integration contract**

The overview screen should consume:

```ts
summary.selectedBudget
summary.totalOverspend
summary.averageMonthlyOverspend
summary.selectedMonthRanking
summary.overspendMonthCount
```

- [ ] **Step 2: Run typecheck to verify the new component contract fails first**

Run: `npx tsc --noEmit`
Expected: FAIL until the new props/components exist.

- [ ] **Step 3: Implement the minimal UI split**

Create focused presentation components:

```ts
// src/components/BudgetPanels.tsx
export function BudgetHeroStrip(...) {}
export function BudgetStatGrid(...) {}

// src/components/RankingLists.tsx
export function CategoryRankingList(...) {}
```

Overview requirements:
- hero keeps current month total as the loudest number
- add budget progress bar and state pill
- replace old metric chips with `本月预算状态`、`累计超支`、`平均每月超支`
- add `超支月份数` as a supporting stat
- add `本月分类消费排名` block above the broader category breakdown

- [ ] **Step 4: Run typecheck to verify overview compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add App.tsx src/components/BudgetPanels.tsx src/components/RankingLists.tsx
git commit -m "feat: add overview budget and ranking UI"
```

### Task 5: Add category cross-month ranking and trend-page polish

**Files:**
- Modify: `App.tsx`
- Modify: `src/components/RankingLists.tsx`
- Modify: `src/components/BudgetPanels.tsx`

- [ ] **Step 1: Write the failing integration contract**

Trend page should support:

```ts
summary.categoryMonthRanking
summary.defaultCategoryRankingName
summary.monthlyTrend
MONTHLY_BUDGET_LIMIT
```

- [ ] **Step 2: Run typecheck to verify the new trend props fail first**

Run: `npx tsc --noEmit`
Expected: FAIL until trend page state and props are wired.

- [ ] **Step 3: Implement the minimal trend-page additions**

Required behavior:
- show `累计超支`、`平均每月超支`、`超支月份数`
- render both charts with `budgetLimit={MONTHLY_BUDGET_LIMIT}`
- add a category selector chip row
- show `同分类跨月排名` list with month + amount + rank badge
- default selected category to the top category of the chosen month, then preserve user changes when valid

- [ ] **Step 4: Run typecheck to verify trend page compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add App.tsx src/components/BudgetPanels.tsx src/components/RankingLists.tsx
git commit -m "feat: add cross-month category ranking insights"
```

### Task 6: Verify, build Android artifacts, and inspect for final polish

**Files:**
- Modify: any touched files from Tasks 1-5 if verification reveals issues

- [ ] **Step 1: Run the summary test suite**

Run: `npx vitest run src/lib/ledgerSummary.test.ts`
Expected: PASS

- [ ] **Step 2: Run static verification**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npx expo-doctor`
Expected: 17/17 checks passed, allowing the bundled native modules warning if no failure is reported

- [ ] **Step 3: Build fresh Android artifacts**

Run: `D:\Gradle\dist\gradle-8.14.3\bin\gradle.bat assembleRelease bundleRelease --console=plain`
Workdir: `android`
Expected: BUILD SUCCESSFUL plus fresh `apk` and `aab`

- [ ] **Step 4: Inspect final git diff for unnecessary UI noise**

Run: `git diff --stat`
Expected: only budget/ranking/UI files and expected package metadata changes

- [ ] **Step 5: Commit**

```bash
git add App.tsx package.json package-lock.json src/components/*.tsx src/lib/*.ts src/types/ledger.ts
git commit -m "feat: add budget health and ranking insights"
```
