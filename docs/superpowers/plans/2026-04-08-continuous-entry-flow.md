# Continuous Entry Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make saving from the add-expense form support continuous month-based entry, keep the save action easy to tap with the keyboard open, and replace the overview overspend-month metric with a net budget balance summary.

**Architecture:** Keep the existing Expo and SQLite data flow intact. Add pure helper logic for the next-category transition and extend the existing summary aggregation with total remaining and net budget balance fields, then wire the UI to use those fields and move the save action into a fixed footer area above the tab bar.

**Tech Stack:** Expo, React Native, TypeScript, Vitest

---

### Task 1: Add failing tests for the new pure logic

**Files:**
- Modify: `D:/MyCode/workspace/monthly-ledger-mobile/src/lib/ledgerSummary.test.ts`
- Create: `D:/MyCode/workspace/monthly-ledger-mobile/src/lib/expenseFormFlow.test.ts`
- Test: `D:/MyCode/workspace/monthly-ledger-mobile/src/lib/expenseFormFlow.ts`

- [ ] **Step 1: Write the failing ledger summary assertions**

```ts
it('computes total remaining and net budget balance across months', () => {
  const summary = buildLedgerSummary(entries, '2026-03', (monthKey) => monthKey.slice(5));

  expect(summary.totalRemaining).toBe(1200);
  expect(summary.netBudgetBalance).toBe(650);
});
```

- [ ] **Step 2: Write the failing category-flow tests**

```ts
import { describe, expect, it } from 'vitest';
import { getNextCategoryStep } from './expenseFormFlow';

describe('getNextCategoryStep', () => {
  it('returns the next category and keeps entry flow active for non-final categories', () => {
    expect(getNextCategoryStep('饮食')).toEqual({
      nextCategory: '医疗',
      shouldReturnToOverview: false,
    });
  });

  it('returns overview intent for the final category', () => {
    expect(getNextCategoryStep('其他')).toEqual({
      nextCategory: null,
      shouldReturnToOverview: true,
    });
  });
});
```

- [ ] **Step 3: Run the failing tests**

Run: `npm test -- src/lib/ledgerSummary.test.ts src/lib/expenseFormFlow.test.ts`
Expected: FAIL because `totalRemaining`, `netBudgetBalance`, and `getNextCategoryStep` do not exist yet.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ledgerSummary.test.ts src/lib/expenseFormFlow.test.ts
git commit -m "test: add continuous-entry regression coverage"
```

### Task 2: Implement the minimal summary and flow helpers

**Files:**
- Modify: `D:/MyCode/workspace/monthly-ledger-mobile/src/lib/ledgerSummary.ts`
- Modify: `D:/MyCode/workspace/monthly-ledger-mobile/src/types/ledger.ts`
- Create: `D:/MyCode/workspace/monthly-ledger-mobile/src/lib/expenseFormFlow.ts`
- Test: `D:/MyCode/workspace/monthly-ledger-mobile/src/lib/ledgerSummary.test.ts`
- Test: `D:/MyCode/workspace/monthly-ledger-mobile/src/lib/expenseFormFlow.test.ts`

- [ ] **Step 1: Add the failing helper export usage**

```ts
export interface LedgerSummary {
  totalRemaining: number;
  netBudgetBalance: number;
}
```

```ts
export function getNextCategoryStep(category: string) {
  return { nextCategory: null, shouldReturnToOverview: false };
}
```

- [ ] **Step 2: Run the targeted tests to verify the shape is still wrong**

Run: `npm test -- src/lib/ledgerSummary.test.ts src/lib/expenseFormFlow.test.ts`
Expected: FAIL on wrong values, not missing imports.

- [ ] **Step 3: Implement the minimal logic**

```ts
let totalRemaining = 0;

for (const row of monthlyBudgetRows) {
  totalOverspend += row.overspend;
  totalRemaining += row.remaining;
}

const netBudgetBalance = totalRemaining - totalOverspend;
```

```ts
const currentIndex = CATEGORY_DEFINITIONS.findIndex((item) => item.name === category);
const finalIndex = CATEGORY_DEFINITIONS.length - 1;

if (currentIndex === -1 || currentIndex >= finalIndex) {
  return { nextCategory: null, shouldReturnToOverview: true };
}

return {
  nextCategory: CATEGORY_DEFINITIONS[currentIndex + 1]?.name ?? null,
  shouldReturnToOverview: false,
};
```

- [ ] **Step 4: Run the tests again**

Run: `npm test -- src/lib/ledgerSummary.test.ts src/lib/expenseFormFlow.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ledgerSummary.ts src/types/ledger.ts src/lib/expenseFormFlow.ts src/lib/ledgerSummary.test.ts src/lib/expenseFormFlow.test.ts
git commit -m "feat: add net budget balance and next-category flow helpers"
```

### Task 3: Wire the form to support continuous entry and a fixed save area

**Files:**
- Modify: `D:/MyCode/workspace/monthly-ledger-mobile/src/components/ExpenseForm.tsx`
- Modify: `D:/MyCode/workspace/monthly-ledger-mobile/App.tsx`
- Test: `D:/MyCode/workspace/monthly-ledger-mobile/src/lib/expenseFormFlow.test.ts`

- [ ] **Step 1: Change the form contract and let type usage fail**

Use this shape:

```ts
interface ExpenseFormProps {
  onSubmit: (draft: ExpenseDraft) => Promise<void>;
  onCompleteSequence: () => void;
}
```

- [ ] **Step 2: Run TypeScript to verify the old component call sites fail**

Run: `npx tsc --noEmit`
Expected: FAIL because `ExpenseForm` consumers do not yet satisfy the new prop and render shape.

- [ ] **Step 3: Implement the minimal UI and flow changes**

Key behavior:

```ts
await onSubmit(draft);

const nextStep = getNextCategoryStep(category);
setAmount('');
setNote('');

if (nextStep.shouldReturnToOverview) {
  onCompleteSequence();
  return;
}

if (nextStep.nextCategory) {
  handleSelectCategory(nextStep.nextCategory);
}
```

Layout requirements:

- Move the submit button out of the scroll content into a fixed footer container.
- Keep `monthKey` untouched after save.
- Preserve enough bottom padding in the scroll content so the note field and chips are not hidden behind the fixed footer.

- [ ] **Step 4: Run TypeScript again**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add App.tsx src/components/ExpenseForm.tsx
git commit -m "feat: support continuous expense entry flow"
```

### Task 4: Replace the overview metric with net budget balance copy

**Files:**
- Modify: `D:/MyCode/workspace/monthly-ledger-mobile/App.tsx`
- Modify: `D:/MyCode/workspace/monthly-ledger-mobile/src/lib/format.ts` if a small formatter helper is needed
- Test: `D:/MyCode/workspace/monthly-ledger-mobile/src/lib/ledgerSummary.test.ts`

- [ ] **Step 1: Switch the overview usage to the new summary fields**

Use the new metric:

```ts
const netBudgetStatus =
  summary.netBudgetBalance >= 0
    ? `净结余 ${formatCurrency(summary.netBudgetBalance)}`
    : `净超支 ${formatCurrency(Math.abs(summary.netBudgetBalance))}`;
```

- [ ] **Step 2: Run TypeScript to verify the summary fields are consumed correctly**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Update the overview metric label**

Replace:

```ts
<MetricChip label="超支月份数" value={`${summary.overspendMonthCount} 个`} />
```

With:

```ts
<MetricChip label="综合超支情况" value={netBudgetStatus} />
```

- [ ] **Step 4: Run the relevant tests**

Run: `npm test -- src/lib/ledgerSummary.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add App.tsx src/lib/ledgerSummary.ts src/lib/ledgerSummary.test.ts
git commit -m "feat: show net budget balance in overview"
```

### Task 5: Verify the whole change set

**Files:**
- Modify: any touched file if verification reveals an issue

- [ ] **Step 1: Run the full unit test set**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: Run TypeScript verification**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Inspect the final diff**

Run: `git diff --stat`
Expected: only the intended docs, summary logic, form flow, and overview UI files

- [ ] **Step 4: Commit**

```bash
git add App.tsx docs/superpowers/specs/2026-04-08-continuous-entry-flow-design.md docs/superpowers/plans/2026-04-08-continuous-entry-flow.md src/components/ExpenseForm.tsx src/lib/expenseFormFlow.ts src/lib/expenseFormFlow.test.ts src/lib/ledgerSummary.ts src/lib/ledgerSummary.test.ts src/types/ledger.ts
git commit -m "feat: improve continuous entry flow"
```
