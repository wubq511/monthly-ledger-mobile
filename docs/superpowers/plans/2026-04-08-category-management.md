# Category Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent category management so users can create, edit, delete, and reorder categories/subcategories, with history-safe rename/delete behavior and backup support.

**Architecture:** Move runtime category definitions from static constants into SQLite tables seeded from the existing defaults. Expose category data through dedicated database helpers and a new hook, then update entry flow, backup payloads, and a management modal to read/write the database-backed order and names.

**Tech Stack:** Expo SQLite, React Native, TypeScript, Vitest

---

## File Map

- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\types\ledger.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\constants\categories.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\database.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\database.test.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\backup.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\backup.test.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\expenseFormFlow.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\expenseFormFlow.test.ts`
- Create: `D:\MyCode\workspace\monthly-ledger-mobile\src\hooks\useCategoryData.ts`
- Create: `D:\MyCode\workspace\monthly-ledger-mobile\src\components\CategoryManagerModal.tsx`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\components\ExpenseForm.tsx`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\components\BackupActions.tsx`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\App.tsx`

### Task 1: Add database-backed category models

**Files:**
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\types\ledger.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\constants\categories.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\database.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\database.test.ts`

- [ ] **Step 1: Write the failing tests**

Add database tests for:

```ts
it('seeds default categories on first init', async () => {
  const db = await createTestDatabase();
  await initializeDatabase(db);

  const categories = await getAllCategories(db);

  expect(categories.length).toBeGreaterThan(0);
  expect(categories[0]?.name).toBe('饮食');
});

it('renames a category and updates historical expense rows', async () => {
  const db = await createTestDatabase();
  await initializeDatabase(db);
  const [category] = await getAllCategories(db);
  await insertExpense(db, {
    monthKey: '2026-04',
    amount: 20,
    category: category.name,
    subcategory: null,
    note: null,
  });

  await renameCategory(db, category.id, '三餐');
  const expenses = await getAllExpenses(db);

  expect(expenses[0]?.category).toBe('三餐');
});

it('deletes a category without deleting historical expense rows', async () => {
  const db = await createTestDatabase();
  await initializeDatabase(db);
  const [category] = await getAllCategories(db);
  await insertExpense(db, {
    monthKey: '2026-04',
    amount: 20,
    category: category.name,
    subcategory: null,
    note: null,
  });

  await deleteCategory(db, category.id);

  const expenses = await getAllExpenses(db);
  const categories = await getAllCategories(db);
  expect(expenses).toHaveLength(1);
  expect(categories.find((item) => item.id === category.id)).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/database.test.ts`
Expected: FAIL because category table APIs do not exist yet.

- [ ] **Step 3: Implement minimal schema and helpers**

In `database.ts`, add:

```ts
CREATE TABLE IF NOT EXISTS categories (...);
CREATE TABLE IF NOT EXISTS subcategories (...);
```

Implement:

```ts
export async function getAllCategories(db: SQLiteDatabase): Promise<CategoryRecord[]> { ... }
export async function createCategory(db: SQLiteDatabase, input: CreateCategoryInput) { ... }
export async function updateCategoryOrder(db: SQLiteDatabase, idsInOrder: string[]) { ... }
export async function renameCategory(db: SQLiteDatabase, id: string, name: string) { ... }
export async function deleteCategory(db: SQLiteDatabase, id: string) { ... }
export async function getCategoryUsageSummary(db: SQLiteDatabase, id: string) { ... }
```

Seed `CATEGORY_DEFINITIONS` into the new tables during `initializeDatabase()` only when the table is empty.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/database.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/ledger.ts src/constants/categories.ts src/lib/database.ts src/lib/database.test.ts
git commit -m "feat: persist category definitions in sqlite"
```

### Task 2: Add subcategory CRUD and ordered next-category flow

**Files:**
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\database.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\database.test.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\expenseFormFlow.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\expenseFormFlow.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests for:

```ts
it('renames a subcategory and updates historical expense rows', async () => {
  const db = await createTestDatabase();
  await initializeDatabase(db);
  const category = (await getAllCategories(db)).find((item) => item.subcategories.length > 0)!;
  const subcategory = category.subcategories[0]!;
  await insertExpense(db, {
    monthKey: '2026-04',
    amount: 18,
    category: category.name,
    subcategory: subcategory.name,
    note: null,
  });

  await renameSubcategory(db, subcategory.id, '夜宵');
  const expenses = await getAllExpenses(db);
  expect(expenses[0]?.subcategory).toBe('夜宵');
});

it('returns the next category based on persisted order', () => {
  expect(getNextCategoryStep(['饮食', '交通', '其他'], '交通')).toEqual({
    nextCategory: '其他',
    shouldReturnToOverview: false,
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/database.test.ts src/lib/expenseFormFlow.test.ts`
Expected: FAIL because subcategory CRUD and dynamic ordering are missing.

- [ ] **Step 3: Implement minimal support**

Add subcategory helpers:

```ts
export async function createSubcategory(db: SQLiteDatabase, categoryId: string, name: string) { ... }
export async function renameSubcategory(db: SQLiteDatabase, id: string, name: string) { ... }
export async function deleteSubcategory(db: SQLiteDatabase, id: string) { ... }
export async function getSubcategoryUsageSummary(db: SQLiteDatabase, id: string) { ... }
```

Refactor the form-flow helper to:

```ts
export function getNextCategoryStep(orderedCategoryNames: string[], categoryName: string): NextCategoryStep { ... }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/database.test.ts src/lib/expenseFormFlow.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/database.ts src/lib/database.test.ts src/lib/expenseFormFlow.ts src/lib/expenseFormFlow.test.ts
git commit -m "feat: add subcategory management and ordered entry flow"
```

### Task 3: Add category hook and backup schema support

**Files:**
- Create: `D:\MyCode\workspace\monthly-ledger-mobile\src\hooks\useCategoryData.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\backup.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\lib\backup.test.ts`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\components\BackupActions.tsx`

- [ ] **Step 1: Write the failing tests**

Add backup tests for:

```ts
it('builds a backup payload including categories and subcategories', () => {
  const payload = buildBackupPayload(entries, categories, '1.0.6', '2026-04-08T00:00:00.000Z');
  expect(payload.categories).toHaveLength(2);
  expect(payload.categories[0]?.subcategories[0]?.name).toBe('食堂');
});

it('parses the upgraded backup schema including category data', () => {
  const parsed = parseBackupJson(JSON.stringify(payload));
  expect(parsed.categories[0]?.name).toBe('饮食');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/backup.test.ts`
Expected: FAIL because schema version 1 payload has no category config.

- [ ] **Step 3: Implement minimal support**

Upgrade backup schema:

```ts
export const BACKUP_SCHEMA_VERSION = 2;

interface LedgerBackupFile {
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  entries: ExpenseEntry[];
  categories: CategoryRecord[];
}
```

Update `BackupActions` to export/import both entries and categories using the new database helpers.

Create `useCategoryData.ts` with:

```ts
export function useCategoryData() {
  return {
    categories,
    loading,
    error,
    refresh,
    createCategory,
    renameCategory,
    deleteCategory,
    createSubcategory,
    renameSubcategory,
    deleteSubcategory,
    reorderCategories,
    getCategoryUsageSummary,
    getSubcategoryUsageSummary,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/backup.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCategoryData.ts src/lib/backup.ts src/lib/backup.test.ts src/components/BackupActions.tsx
git commit -m "feat: back up and restore category configuration"
```

### Task 4: Build category manager modal UI

**Files:**
- Create: `D:\MyCode\workspace\monthly-ledger-mobile\src\components\CategoryManagerModal.tsx`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\types\ledger.ts`

- [ ] **Step 1: Write the failing test or fixture-style UI smoke check**

For this codebase, add a pure helper test for reorder intent instead of a component renderer test:

```ts
it('moves the dragged category id to the drop index', () => {
  expect(moveCategoryId(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a']);
});
```

Put the helper near the modal file or in a tiny lib file if needed.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/categoryOrder.test.ts`
Expected: FAIL because reorder helper does not exist.

- [ ] **Step 3: Implement the modal and helper**

Build a modal that:

```tsx
<Modal transparent visible={visible}>
  <Pressable style={styles.backdrop} onPress={onClose} />
  <View style={styles.sheet}>
    <Text style={styles.title}>分类管理</Text>
    {/* add category button */}
    {/* draggable category list */}
    {/* subcategory rows with add/edit/delete */}
  </View>
</Modal>
```

Required behaviors:
- add / edit / delete category
- add / edit / delete subcategory
- usage-warning confirmation before delete
- long-press reorder for category rows

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/categoryOrder.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/CategoryManagerModal.tsx src/lib/categoryOrder.ts src/lib/categoryOrder.test.ts src/types/ledger.ts
git commit -m "feat: add category management modal"
```

### Task 5: Wire the database-backed categories into the entry flow

**Files:**
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\components\ExpenseForm.tsx`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\App.tsx`
- Modify: `D:\MyCode\workspace\monthly-ledger-mobile\src\hooks\useLedgerData.ts`

- [ ] **Step 1: Write the failing tests**

Add a form-flow test for fallback behavior:

```ts
it('returns to overview when the current category is the final item in the custom order', () => {
  expect(getNextCategoryStep(['饮食', '娱乐'], '娱乐')).toEqual({
    nextCategory: null,
    shouldReturnToOverview: true,
  });
});
```

If needed, add a small pure helper for selected-category fallback:

```ts
expect(resolveActiveCategory(['交通', '其他'], '饮食')).toBe('交通');
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/expenseFormFlow.test.ts`
Expected: FAIL because the helper signatures and fallback behavior changed.

- [ ] **Step 3: Implement minimal integration**

Update `ExpenseForm` to accept live categories and mutation callbacks:

```tsx
<ExpenseForm
  categories={categories}
  onCreateCategory={...}
  onRenameCategory={...}
  onDeleteCategory={...}
  onCreateSubcategory={...}
  onRenameSubcategory={...}
  onDeleteSubcategory={...}
  onReorderCategories={...}
/>
```

Required wiring:
- use live categories instead of `CATEGORY_DEFINITIONS`
- derive current subcategories from selected category record
- open `CategoryManagerModal` from the add page
- use persisted order for continuous next-category stepping
- recover to the first valid category if the selected one no longer exists

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/expenseFormFlow.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ExpenseForm.tsx App.tsx src/hooks/useLedgerData.ts src/lib/expenseFormFlow.ts src/lib/expenseFormFlow.test.ts
git commit -m "feat: drive entry categories from managed category data"
```

### Task 6: Full regression verification

**Files:**
- Modify as needed: any touched file above

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: PASS with all test files green.

- [ ] **Step 2: Run the TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run a release build smoke check**

Run: `cd android && .\\gradlew.bat assembleDebug --console=plain`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit final cleanup if needed**

```bash
git add App.tsx src components src/lib docs
git commit -m "test: verify category management integration"
```

## Self-Review

- Spec coverage checked:
  - database-backed categories: Task 1
  - rename/delete semantics and history preservation: Tasks 1-2
  - backup integration: Task 3
  - management modal: Task 4
  - ordered continuous entry flow: Task 5
  - verification: Task 6
- Placeholder scan completed; no TBD/TODO markers left.
- Type consistency checked across category record, backup payload, and flow helper names.
