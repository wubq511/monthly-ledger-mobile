# Trend Window And Data Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Slim down the trends page, move backup controls into the add-entry flow, and make the six-month line chart browse across time via horizontal swipes without overflowing narrow screens.

**Architecture:** Keep `selectedMonth` as the single source of truth for trends and rankings. Add a small pure helper module for trend-window month generation and swipe-to-month resolution, then wire the line chart to update `selectedMonth` while cleaning up the page layout and moving backup actions into the add form scroll area.

**Tech Stack:** Expo, React Native, TypeScript, react-native-svg, Vitest

---

### Task 1: Add failing tests for trend-window helpers

**Files:**
- Create: `D:/MyCode/workspace/monthly-ledger-mobile/src/lib/trendWindow.test.ts`
- Test: `D:/MyCode/workspace/monthly-ledger-mobile/src/lib/trendWindow.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildTrendWindowMonths, getTrendMonthAfterSwipe } from './trendWindow';

describe('buildTrendWindowMonths', () => {
  it('builds a six-month window ending at the selected month', () => {
    expect(buildTrendWindowMonths('2026-03')).toEqual([
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
    ]);
  });
});

describe('getTrendMonthAfterSwipe', () => {
  it('moves forward one month after a left swipe', () => {
    expect(getTrendMonthAfterSwipe('2026-03', -48)).toBe('2026-04');
  });

  it('moves backward one month after a right swipe', () => {
    expect(getTrendMonthAfterSwipe('2026-03', 48)).toBe('2026-02');
  });

  it('keeps the current month when the swipe is below threshold', () => {
    expect(getTrendMonthAfterSwipe('2026-03', 16)).toBe('2026-03');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/trendWindow.test.ts`
Expected: FAIL because `trendWindow.ts` does not exist yet.

- [ ] **Step 3: Commit**

```bash
git add src/lib/trendWindow.test.ts
git commit -m "test: add trend window helper coverage"
```

### Task 2: Implement the trend-window helper and use it in summary/chart flow

**Files:**
- Create: `D:/MyCode/workspace/monthly-ledger-mobile/src/lib/trendWindow.ts`
- Modify: `D:/MyCode/workspace/monthly-ledger-mobile/src/lib/ledgerSummary.ts`
- Test: `D:/MyCode/workspace/monthly-ledger-mobile/src/lib/trendWindow.test.ts`

- [ ] **Step 1: Create the minimal helper exports**

```ts
export const TREND_WINDOW_SIZE = 6;
```

- [ ] **Step 2: Run the targeted tests again**

Run: `npm test -- src/lib/trendWindow.test.ts`
Expected: FAIL on missing function implementations or wrong return values.

- [ ] **Step 3: Implement the minimal helper logic**

```ts
import { shiftMonth } from './date';

export function buildTrendWindowMonths(selectedMonth: string, size = TREND_WINDOW_SIZE) {
  return Array.from({ length: size }, (_, index) => shiftMonth(selectedMonth, index - (size - 1)));
}

export function getTrendMonthAfterSwipe(selectedMonth: string, dx: number, threshold = 36) {
  if (dx <= -threshold) {
    return shiftMonth(selectedMonth, 1);
  }

  if (dx >= threshold) {
    return shiftMonth(selectedMonth, -1);
  }

  return selectedMonth;
}
```

- [ ] **Step 4: Use `buildTrendWindowMonths` inside `buildLedgerSummary`**

Replace the inline `Array.from({ length: 6 })` monthly trend generation with the helper output so chart windows and tests share one source of truth.

- [ ] **Step 5: Run the tests**

Run: `npm test -- src/lib/trendWindow.test.ts src/lib/ledgerSummary.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/trendWindow.ts src/lib/trendWindow.test.ts src/lib/ledgerSummary.ts
git commit -m "feat: add swipeable trend window helpers"
```

### Task 3: Clean up trends page layout and move backup actions

**Files:**
- Modify: `D:/MyCode/workspace/monthly-ledger-mobile/App.tsx`
- Modify: `D:/MyCode/workspace/monthly-ledger-mobile/src/components/ExpenseForm.tsx`
- Modify: `D:/MyCode/workspace/monthly-ledger-mobile/src/components/Charts.tsx`
- Modify: `D:/MyCode/workspace/monthly-ledger-mobile/src/components/BackupActions.tsx`

- [ ] **Step 1: Change the chart prop contract to support swipes**

Use this shape:

```ts
interface MonthlyLineChartProps {
  data: MonthlyTrendPoint[];
  budgetLimit: number;
  selectedMonth: string;
  onChangeMonth: (monthKey: string) => void;
}
```

- [ ] **Step 2: Run TypeScript to verify call sites fail first**

Run: `npx tsc --noEmit`
Expected: FAIL until `App.tsx` and the chart implementation are updated.

- [ ] **Step 3: Implement the UI cleanup**

Required changes:

- move `<BackupActions onImported={refresh} />` into the add-entry form scroll area
- remove the trends-page body copy under `预算趋势`
- remove the line-chart subtitle and the bar-chart module from the trends page
- wire horizontal swipe on the line chart to call `onChangeMonth(getTrendMonthAfterSwipe(...))`
- fix chart header overflow with shrinking title/peak layout
- move the budget label inward so it never clips

- [ ] **Step 4: Run TypeScript again**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add App.tsx src/components/ExpenseForm.tsx src/components/Charts.tsx src/components/BackupActions.tsx
git commit -m "feat: streamline trends page and move data management"
```

### Task 4: Verify the final change set

**Files:**
- Modify: any touched file if verification reveals issues

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: Run TypeScript verification**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Inspect the diff**

Run: `git diff --stat`
Expected: only trend layout, chart, helper, backup placement, and docs files

- [ ] **Step 4: Commit**

```bash
git add App.tsx docs/superpowers/specs/2026-04-08-trend-window-and-data-management-design.md docs/superpowers/plans/2026-04-08-trend-window-and-data-management.md src/components/BackupActions.tsx src/components/Charts.tsx src/components/ExpenseForm.tsx src/lib/trendWindow.ts src/lib/trendWindow.test.ts src/lib/ledgerSummary.ts
git commit -m "feat: add swipeable trend browsing"
```
