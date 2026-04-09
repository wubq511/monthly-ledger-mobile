# Category Drag Reorder And Nested Sequence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current homemade drag logic with a mainstream smooth drag-and-drop experience for categories and subcategories, and make continuous entry advance through subcategories before moving to the next category.

**Architecture:** Keep the existing SQLite-backed category model and sequential-entry rules, but swap the modal’s drag layer to `react-native-draggable-flatlist` with `react-native-gesture-handler` and `react-native-reanimated`. Add local optimistic reorder helpers so drag interactions stay smooth before persistence catches up, then wire the existing order APIs and nested next-step traversal into the updated UI.

**Tech Stack:** React Native, Expo SQLite, React Native Gesture Handler, React Native Reanimated, React Native Draggable FlatList, TypeScript, Vitest

---

## File Map

- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\src\lib\categoryReorder.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\src\lib\categoryReorder.test.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\src\lib\database.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\src\lib\database.test.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\src\lib\expenseFormFlow.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\src\lib\expenseFormFlow.test.ts`
- Create: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\babel.config.js`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\index.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\package.json`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\package-lock.json`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\src\hooks\useCategoryData.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\App.tsx`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\src\components\CategoryManagerModal.tsx`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\src\components\ExpenseForm.tsx`

### Task 1: Add reorder helpers and persistence for subcategories

**Files:**
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\src\lib\categoryReorder.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\src\lib\categoryReorder.test.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\src\lib\database.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\src\lib\database.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests for:

```ts
it('moves an item from the middle to the front', () => {
  expect(moveItem(['a', 'b', 'c', 'd'], 2, 0)).toEqual(['c', 'a', 'b', 'd']);
});

it('persists subcategory order changes for subsequent reads', async () => {
  const db = new FakeDatabase([]);
  await initializeDatabase(db as never);
  const category = (await getAllCategories(db as never)).find((item) => item.subcategories.length > 2)!;
  const ids = category.subcategories.slice(0, 3).map((item) => item.id);

  await updateSubcategoryOrder(db as never, category.id, [ids[2]!, ids[0]!, ids[1]!]);

  const refreshed = (await getAllCategories(db as never)).find((item) => item.id === category.id)!;
  expect(refreshed.subcategories.slice(0, 3).map((item) => item.id)).toEqual([
    ids[2],
    ids[0],
    ids[1],
  ]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/categoryReorder.test.ts src/lib/database.test.ts`
Expected: FAIL because generic move helpers and subcategory order persistence are missing.

- [ ] **Step 3: Implement the minimal code**

In `categoryReorder.ts`, add a generic helper:

```ts
export function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  ...
}
```

Retain `moveCategoryBeforeTarget` by rewriting it in terms of `moveItem`.

In `database.ts`, add:

```ts
export async function updateSubcategoryOrder(
  db: SQLiteDatabase,
  categoryId: string,
  idsInOrder: string[]
) {
  ...
}
```

Update the fake database in `database.test.ts` so `UPDATE subcategories SET sort_order = ?, updated_at = ? WHERE id = ? AND category_id = ?` mutates the in-memory rows.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/categoryReorder.test.ts src/lib/database.test.ts`
Expected: PASS

### Task 2: Replace category-only next-step logic with nested traversal

**Files:**
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\src\lib\expenseFormFlow.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\src\lib\expenseFormFlow.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests for:

```ts
it('moves to the next subcategory before changing category', () => {
  expect(getNextCategoryStep(categoryTree, '饮食', '食堂')).toEqual({
    nextCategory: '饮食',
    nextSubcategory: '外卖',
    shouldReturnToOverview: false,
  });
});

it('moves to the next category after the last subcategory', () => {
  expect(getNextCategoryStep(categoryTree, '饮食', '外卖')).toEqual({
    nextCategory: '交通',
    nextSubcategory: '地铁',
    shouldReturnToOverview: false,
  });
});

it('returns overview when already at the final category position', () => {
  expect(getNextCategoryStep(categoryTree, '其他', null)).toEqual({
    nextCategory: null,
    nextSubcategory: null,
    shouldReturnToOverview: true,
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/expenseFormFlow.test.ts`
Expected: FAIL because the helper only understands category names.

- [ ] **Step 3: Implement the minimal code**

Change the helper contract to accept ordered category records:

```ts
interface NextCategoryStep {
  nextCategory: string | null;
  nextSubcategory: string | null;
  shouldReturnToOverview: boolean;
}
```

Implement traversal rules:

- same category, next subcategory if present
- otherwise next category and its first subcategory
- otherwise overview

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/expenseFormFlow.test.ts`
Expected: PASS

### Task 3: Wire persistence and form behavior to the new ordering model

**Files:**
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\src\hooks\useCategoryData.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\App.tsx`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\src\components\ExpenseForm.tsx`

- [ ] **Step 1: Write the failing test**

Add or update form-flow-facing tests around the helper, then rely on TypeScript to catch the prop contract changes.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/expenseFormFlow.test.ts && npx tsc --noEmit`
Expected: TypeScript errors because the UI still uses the old helper signature and there is no subcategory reorder mutation path.

- [ ] **Step 3: Implement the minimal code**

Add to `useCategoryData()`:

```ts
reorderSubcategories: async (categoryId: string, idsInOrder: string[]) => {
  await runMutation(() => updateSubcategoryOrder(db, categoryId, idsInOrder));
}
```

Plumb the new prop through `App.tsx` into `ExpenseForm.tsx`.

Update `handleSubmit()` in `ExpenseForm.tsx` to call the new helper with the live category tree and current subcategory, then:

- clear amount/note
- keep month
- set next category
- set next subcategory
- focus amount
- only return to overview when helper says so

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/database.test.ts src/lib/categoryReorder.test.ts src/lib/expenseFormFlow.test.ts && npx tsc --noEmit`
Expected: PASS

### Task 4: Install and configure mainstream drag dependencies

**Files:**
- Create: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\babel.config.js`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\index.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\package.json`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\package-lock.json`

- [ ] **Step 1: Install compatible packages**

Run:

```bash
npx expo install react-native-gesture-handler react-native-reanimated
npm install react-native-draggable-flatlist
```

Expected: package manifests update without peer dependency conflicts.

- [ ] **Step 2: Add the required runtime configuration**

Create `babel.config.js`:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

Update `index.ts` to import gesture-handler before the app entry and update the root component tree to use `GestureHandlerRootView`.

- [ ] **Step 3: Run the safety check**

Run: `npx tsc --noEmit`
Expected: PASS

### Task 5: Replace homemade drag UI with smooth drag lists

**Files:**
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\src\components\CategoryManagerModal.tsx`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\src\lib\categoryReorder.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\src\lib\categoryReorder.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests for optimistic nested reordering helpers:

```ts
it('reorders categories in-place by drag indexes', () => {
  expect(reorderCategoriesTree(categories, 2, 0).map((item) => item.id)).toEqual([
    'traffic',
    'food',
    'other',
  ]);
});

it('reorders subcategories only within the selected category', () => {
  const next = reorderSubcategoriesTree(categories, 'food', 1, 0);
  expect(next[0]?.subcategories.map((item) => item.id)).toEqual(['takeout', 'canteen']);
  expect(next[1]?.subcategories.map((item) => item.id)).toEqual(['subway']);
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- src/lib/categoryReorder.test.ts`
Expected: FAIL because the nested tree helpers do not exist yet.

- [ ] **Step 3: Implement the minimal code**

In `categoryReorder.ts`, add optimistic helpers for category and subcategory trees.

Inside `CategoryManagerModal.tsx`:

- remove the custom `onTouchStart/onTouchMove/measureInWindow` drag system entirely
- render categories with `DraggableFlatList`
- render each category’s subcategories with a non-scrolling `DraggableFlatList`
- use explicit drag handles with `drag()` on long press
- add smooth decorators / active state styling
- update local modal state optimistically on drag end
- persist order through `onReorderCategories` and `onReorderSubcategories`

Keep existing create / rename / delete actions unchanged.

- [ ] **Step 4: Run the focused verification**

Run: `npm test -- src/lib/categoryReorder.test.ts && npx tsc --noEmit`
Expected: PASS

### Task 6: Full verification

**Files:**
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\docs\superpowers\specs\2026-04-09-category-drag-reorder-and-nested-sequence-design.md`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\.worktrees\codex-category-management\docs\superpowers\plans\2026-04-09-category-drag-reorder-and-nested-sequence.md`

- [ ] **Step 1: Run targeted tests**

Run: `npm test -- src/lib/categoryReorder.test.ts src/lib/database.test.ts src/lib/expenseFormFlow.test.ts`
Expected: PASS

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: PASS with 0 failed tests

- [ ] **Step 3: Run type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Review docs for drift**

Confirm the spec and plan still describe the final behavior:
- drag reorder for categories and subcategories using the library-backed approach
- nested sequential advancement
- no backup schema changes
