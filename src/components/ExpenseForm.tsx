import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  type KeyboardEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LedgerManagementHubModal } from './LedgerManagementHubModal';
import {
  DEFAULT_CATEGORY,
  getRuntimeCategoryDefinition,
  getRuntimeDefaultCategory,
} from '../constants/categories';
import { getCurrentMonthKey, getPreviousMonthKey, isValidMonthInput } from '../lib/date';
import { getExpenseFormLayoutMetrics, getKeyboardInset } from '../lib/expenseFormLayout';
import { getNextCategoryStep } from '../lib/expenseFormFlow';
import type {
  BudgetSettings,
  CategoryRecord,
  CategoryUsageSummary,
  ExpenseDraft,
  SubcategoryUsageSummary,
} from '../types/ledger';

interface ExpenseFormProps {
  categories: CategoryRecord[];
  categoriesLoading: boolean;
  onSubmit: (draft: ExpenseDraft) => Promise<void>;
  onCompleteSequence: () => void;
  onImported: () => Promise<void>;
  budgetSettings: BudgetSettings;
  budgetLoading: boolean;
  budgetError: string | null;
  onRefreshBudgetSettings: () => Promise<void>;
  onSetDefaultBudget: (amount: number) => Promise<void>;
  onSetMonthlyBudgetOverride: (monthKey: string, amount: number) => Promise<void>;
  onClearMonthlyBudgetOverride: (monthKey: string) => Promise<void>;
  onCreateCategory: (name: string) => Promise<void>;
  onRenameCategory: (id: string, name: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onReorderCategories: (idsInOrder: string[]) => Promise<void>;
  onReorderSubcategories: (categoryId: string, idsInOrder: string[]) => Promise<void>;
  onCreateSubcategory: (categoryId: string, name: string) => Promise<void>;
  onRenameSubcategory: (id: string, name: string) => Promise<void>;
  onDeleteSubcategory: (id: string) => Promise<void>;
  getCategoryUsageSummary: (id: string) => Promise<CategoryUsageSummary>;
  getSubcategoryUsageSummary: (id: string) => Promise<SubcategoryUsageSummary>;
}

export function ExpenseForm({
  categories,
  categoriesLoading,
  onSubmit,
  onCompleteSequence,
  onImported,
  budgetSettings,
  budgetLoading,
  budgetError,
  onRefreshBudgetSettings,
  onSetDefaultBudget,
  onSetMonthlyBudgetOverride,
  onClearMonthlyBudgetOverride,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
  onReorderCategories,
  onReorderSubcategories,
  onCreateSubcategory,
  onRenameSubcategory,
  onDeleteSubcategory,
  getCategoryUsageSummary,
  getSubcategoryUsageSummary,
}: ExpenseFormProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const defaultCategory = getRuntimeDefaultCategory(categories);
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(defaultCategory.name);
  const [subcategory, setSubcategory] = useState(defaultCategory.subcategories[0] ?? '');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [managementHubVisible, setManagementHubVisible] = useState(false);
  const amountInputRef = useRef<TextInput | null>(null);

  const categoryDefinition = getRuntimeCategoryDefinition(categories, category);
  const activeCategoryRecord = categories.find((item) => item.name === category) ?? null;
  const layoutMetrics = getExpenseFormLayoutMetrics({
    safeAreaBottom: insets.bottom,
    keyboardInset,
  });
  const keyboardVisible = layoutMetrics.compactSubmit;

  useEffect(() => {
    if (categories.length === 0) {
      setCategory(DEFAULT_CATEGORY.name);
      setSubcategory(DEFAULT_CATEGORY.subcategories[0] ?? '');
      return;
    }

    const activeCategory = categories.find((item) => item.name === category);

    if (!activeCategory) {
      const nextDefault = getRuntimeDefaultCategory(categories);
      setCategory(nextDefault.name);
      setSubcategory(nextDefault.subcategories[0] ?? '');
      return;
    }

    const subcategoryNames = activeCategory.subcategories.map((item) => item.name);

    if (subcategory && !subcategoryNames.includes(subcategory)) {
      setSubcategory(subcategoryNames[0] ?? '');
      return;
    }

    if (!subcategory && subcategoryNames.length > 0) {
      setSubcategory(subcategoryNames[0] ?? '');
    }
  }, [categories, category, subcategory]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const handleShow = (event: KeyboardEvent) => {
      setKeyboardInset(
        getKeyboardInset(windowHeight, event.endCoordinates.screenY, event.endCoordinates.height)
      );
    };
    const showSubscription = Keyboard.addListener(showEvent, handleShow);
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [windowHeight]);

  const handleSelectCategory = (nextCategory: string) => {
    const nextDefinition = getRuntimeCategoryDefinition(categories, nextCategory);
    setCategory(nextCategory);
    setSubcategory(nextDefinition.subcategories[0] ?? '');
  };

  const handleOpenManagementHub = () => {
    Keyboard.dismiss();
    setManagementHubVisible(true);
  };

  const handleSubmit = async () => {
    const normalizedAmount = Number(amount);

    if (!isValidMonthInput(monthKey)) {
      Alert.alert('月份格式不正确', '请输入 YYYY-MM 格式，例如 2026-04。');
      return;
    }

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      Alert.alert('金额无效', '请输入大于 0 的金额。');
      return;
    }

    if (categories.length === 0) {
      Alert.alert('暂无可用分类', '请先在分类管理里创建至少一个大类。');
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({
        monthKey,
        amount: normalizedAmount,
        category,
        subcategory: subcategory || null,
        note: note.trim() || null,
      });

      const nextStep = getNextCategoryStep(
        categories,
        category,
        subcategory || null
      );
      setAmount('');
      setNote('');

      if (nextStep.shouldReturnToOverview) {
        Keyboard.dismiss();
        onCompleteSequence();
        return;
      }

      if (nextStep.nextCategory) {
        setCategory(nextStep.nextCategory);
        setSubcategory(nextStep.nextSubcategory ?? '');
      }

      amountInputRef.current?.focus();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : '保存失败，请稍后再试。';
      Alert.alert('保存失败', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: layoutMetrics.contentBottomPadding }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>Quick Capture</Text>
          <Text style={styles.heroTitle}>记下一笔，让总支出和趋势自动更新。</Text>
        </View>

        <Pressable onPress={handleOpenManagementHub} style={styles.backupEntryButton}>
          <Text style={styles.backupEntryLabel}>账本设置</Text>
          <Text style={styles.backupEntryArrow}>↗</Text>
        </Pressable>

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>月份</Text>
          <TextInput
            value={monthKey}
            onChangeText={setMonthKey}
            placeholder="YYYY-MM"
            placeholderTextColor="#A18D80"
            style={styles.textInput}
          />
          <View style={styles.quickRow}>
            <QuickDateButton
              label="本月"
              value={getCurrentMonthKey()}
              currentValue={monthKey}
              onPick={setMonthKey}
            />
            <QuickDateButton
              label="上月"
              value={getPreviousMonthKey()}
              currentValue={monthKey}
              onPick={setMonthKey}
            />
          </View>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>金额</Text>
          <TextInput
            ref={amountInputRef}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor="#A18D80"
            keyboardType="decimal-pad"
            style={styles.amountInput}
          />
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>大类</Text>
          {categories.length > 0 ? (
            <View style={styles.chipGrid}>
              {categories.map((item) => {
                const active = item.name === category;

                return (
                  <Pressable
                    key={item.id}
                    onPress={() => handleSelectCategory(item.name)}
                    style={[
                      styles.categoryChip,
                      active && { backgroundColor: item.color, borderColor: item.color },
                    ]}>
                    <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                      {item.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.inlineEmptyState}>
              <Text style={styles.inlineEmptyStateText}>
                {categoriesLoading ? '正在读取分类...' : '还没有可用大类，先去分类管理里新增一个。'}
              </Text>
            </View>
          )}
        </View>

        {activeCategoryRecord && categoryDefinition.subcategories.length > 0 ? (
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>细分</Text>
            <View style={styles.quickRow}>
              {categoryDefinition.subcategories.map((item) => {
                const active = item === subcategory;

                return (
                  <Pressable
                    key={item}
                    onPress={() => setSubcategory(item)}
                    style={[
                      styles.subcategoryChip,
                      active && {
                        backgroundColor: `${categoryDefinition.color}16`,
                        borderColor: categoryDefinition.color,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.subcategoryChipText,
                        active && { color: categoryDefinition.color },
                      ]}>
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>备注</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="例如：和同学聚餐、补电卡、买洗衣液"
            placeholderTextColor="#A18D80"
            multiline
            style={styles.noteInput}
          />
        </View>
      </ScrollView>

      <View
        style={
          keyboardVisible
            ? [styles.submitDockKeyboard, { bottom: layoutMetrics.submitBottomOffset }]
            : [styles.submitDock, { paddingBottom: layoutMetrics.submitFooterInset }]
        }>
        <Pressable
          onPress={handleSubmit}
          style={[styles.submitButton, keyboardVisible && styles.submitButtonKeyboard]}
          disabled={submitting || categoriesLoading || categories.length === 0}>
          <Text style={styles.submitButtonText}>{submitting ? '保存中...' : '保存这笔支出'}</Text>
        </Pressable>
      </View>

      <LedgerManagementHubModal
        visible={managementHubVisible}
        monthKey={monthKey}
        categories={categories}
        categoriesLoading={categoriesLoading}
        budgetSettings={budgetSettings}
        budgetLoading={budgetLoading}
        budgetError={budgetError}
        onClose={() => setManagementHubVisible(false)}
        onImported={onImported}
        onRefreshBudgetSettings={onRefreshBudgetSettings}
        onSetDefaultBudget={onSetDefaultBudget}
        onSetMonthlyBudgetOverride={onSetMonthlyBudgetOverride}
        onClearMonthlyBudgetOverride={onClearMonthlyBudgetOverride}
        onCreateCategory={onCreateCategory}
        onRenameCategory={onRenameCategory}
        onDeleteCategory={onDeleteCategory}
        onReorderCategories={onReorderCategories}
        onReorderSubcategories={onReorderSubcategories}
        onCreateSubcategory={onCreateSubcategory}
        onRenameSubcategory={onRenameSubcategory}
        onDeleteSubcategory={onDeleteSubcategory}
        getCategoryUsageSummary={getCategoryUsageSummary}
        getSubcategoryUsageSummary={getSubcategoryUsageSummary}
      />
    </View>
  );
}

function QuickDateButton({
  label,
  value,
  currentValue,
  onPick,
}: {
  label: string;
  value: string;
  currentValue: string;
  onPick: (value: string) => void;
}) {
  const active = value === currentValue;

  return (
    <Pressable onPress={() => onPick(value)} style={[styles.quickButton, active && styles.quickButtonActive]}>
      <Text style={[styles.quickButtonText, active && styles.quickButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 20,
  },
  hero: {
    borderRadius: 30,
    backgroundColor: '#1E1A17',
    paddingVertical: 22,
    paddingHorizontal: 22,
    gap: 6,
  },
  kicker: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    color: '#D9B27B',
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#FBF7F1',
  },
  backupEntryButton: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#DCCBBC',
    backgroundColor: '#FBF7F1',
    paddingHorizontal: 18,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  backupEntryLabel: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  backupEntryArrow: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#9A5E3E',
  },
  fieldBlock: {
    gap: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    letterSpacing: 0.4,
    color: '#6B584C',
    textTransform: 'uppercase',
  },
  textInput: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#DCCBBC',
    backgroundColor: '#FBF7F1',
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#231B16',
  },
  amountInput: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#DCCBBC',
    backgroundColor: '#FBF7F1',
    paddingHorizontal: 18,
    paddingVertical: 18,
    fontSize: 30,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  noteInput: {
    minHeight: 112,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#DCCBBC',
    backgroundColor: '#FBF7F1',
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_500Medium',
    lineHeight: 22,
    color: '#231B16',
    textAlignVertical: 'top',
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickButton: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DCCBBC',
    backgroundColor: '#F4ECE2',
  },
  quickButtonActive: {
    backgroundColor: '#C76439',
    borderColor: '#C76439',
  },
  quickButtonText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
    fontWeight: '600',
    color: '#6B584C',
  },
  quickButtonTextActive: {
    color: '#FFF7EF',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  inlineEmptyState: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DCCBBC',
    backgroundColor: '#FBF7F1',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  inlineEmptyStateText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: '#7E6C61',
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DCCBBC',
    backgroundColor: '#FBF7F1',
  },
  categoryChipText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
    fontWeight: '600',
    color: '#4A3930',
  },
  categoryChipTextActive: {
    color: '#FFF7EF',
  },
  subcategoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DCCBBC',
    backgroundColor: '#FBF7F1',
  },
  subcategoryChipText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
    fontWeight: '600',
    color: '#5F4E44',
  },
  submitDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  submitDockKeyboard: {
    position: 'absolute',
    left: 'auto',
    right: 20,
    bottom: 12,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  submitButton: {
    borderRadius: 24,
    backgroundColor: '#231B16',
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#20130D',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  submitButtonKeyboard: {
    minWidth: 154,
    paddingHorizontal: 22,
    paddingVertical: 15,
    borderRadius: 18,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#FBF7F1',
  },
});
