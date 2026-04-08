# Add Page Modal And Overview Declutter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce keyboard obstruction on the add-entry page, convert backup controls into a top entry button with modal presentation, and simplify the overview page so the bill area fills more of the viewport.

**Architecture:** Keep the existing data and backup logic unchanged. Rework `ExpenseForm` presentation state to manage keyboard visibility and modal backup entry locally, while simplifying overview text output and converting the bill section into a fill-capable panel above the tab bar.

**Tech Stack:** Expo, React Native, TypeScript, Vitest

---

### Task 1: Add a failing chart layout regression test

**Files:**
- Create: `D:/MyCode/workspace/monthly-ledger-mobile/src/lib/chartLayout.test.ts`
- Test: `D:/MyCode/workspace/monthly-ledger-mobile/src/lib/chartLayout.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { getBudgetLabelLayout } from './chartLayout';

describe('getBudgetLabelLayout', () => {
  it('keeps the budget label within the chart bounds', () => {
    const layout = getBudgetLabelLayout(280, 18, 72);

    expect(layout.left).toBeGreaterThanOrEqual(26);
    expect(layout.right).toBeLessThanOrEqual(254);
    expect(layout.textX).toBeLessThanOrEqual(248);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/chartLayout.test.ts`
Expected: FAIL because `chartLayout.ts` does not exist yet.

- [ ] **Step 3: Commit**

```bash
git add src/lib/chartLayout.test.ts
git commit -m "test: add chart label layout regression coverage"
```

### Task 2: Implement the minimal chart label helper and use it

**Files:**
- Create: `D:/MyCode/workspace/monthly-ledger-mobile/src/lib/chartLayout.ts`
- Modify: `D:/MyCode/workspace/monthly-ledger-mobile/src/components/Charts.tsx`

- [ ] **Step 1: Add the helper export**

```ts
export function getBudgetLabelLayout(chartWidth: number, chartPadding: number, labelWidth: number) {}
```

- [ ] **Step 2: Run the targeted test again**

Run: `npm test -- src/lib/chartLayout.test.ts`
Expected: FAIL on wrong values until the helper is implemented.

- [ ] **Step 3: Implement the helper and use `textAnchor="end"` in the chart**

Required behavior:

- budget label text is always clamped inside the drawable width
- background pill and text share the same safe-right edge
- chart title and peak text both use `numberOfLines={1}` and constrained width

- [ ] **Step 4: Re-run the chart layout test**

Run: `npm test -- src/lib/chartLayout.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/chartLayout.ts src/lib/chartLayout.test.ts src/components/Charts.tsx
git commit -m "fix: clamp chart labels within card bounds"
```

### Task 3: Rework the add-entry page interaction model

**Files:**
- Modify: `D:/MyCode/workspace/monthly-ledger-mobile/src/components/ExpenseForm.tsx`
- Modify: `D:/MyCode/workspace/monthly-ledger-mobile/App.tsx`

- [ ] **Step 1: Change the form contract so backup UI is owned internally**

Replace the current bottom inline backup content injection with local modal state inside `ExpenseForm`.

- [ ] **Step 2: Run TypeScript to verify call sites fail first**

Run: `npx tsc --noEmit`
Expected: FAIL until `App.tsx` stops passing the removed prop.

- [ ] **Step 3: Implement the minimal interaction changes**

Required behavior:

- remove the small helper text under the hero title
- add a single button under the hero: `账单备份与导入`
- tapping the button opens a transparent modal with the existing backup card
- tapping the backdrop closes the modal
- when the keyboard is visible, render a smaller floating save button instead of the large dock card
- when the keyboard is hidden, render only the large button, not the surrounding framed container

- [ ] **Step 4: Re-run TypeScript**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add App.tsx src/components/ExpenseForm.tsx
git commit -m "feat: add modal backup entry and keyboard-safe submit"
```

### Task 4: Simplify the overview page and let the bill card fill downward

**Files:**
- Modify: `D:/MyCode/workspace/monthly-ledger-mobile/App.tsx`
- Modify: `D:/MyCode/workspace/monthly-ledger-mobile/src/components/BudgetPanels.tsx`
- Modify: `D:/MyCode/workspace/monthly-ledger-mobile/src/components/RankingLists.tsx`

- [ ] **Step 1: Make explanatory text optional where needed**

Use optional body fields or simply stop rendering the related text nodes.

- [ ] **Step 2: Run TypeScript to verify overview usage is consistent**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Implement the overview cleanup**

Required behavior:

- change `消费趋势` page title already preserved
- remove the hero caption under the total amount
- remove the support text under the budget meter
- remove ranking and bill-section helper copy
- convert the bill section into a bordered white panel with `flexGrow` and a reasonable `minHeight`
- ensure the overview content stops above the tab bar without overlap

- [ ] **Step 4: Run verification**

Run: `npm test`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add App.tsx src/components/BudgetPanels.tsx src/components/RankingLists.tsx
git commit -m "feat: declutter overview and expand bill panel"
```
