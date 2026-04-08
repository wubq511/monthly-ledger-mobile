import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackupActions } from './BackupActions';
import { CATEGORY_DEFINITIONS, DEFAULT_CATEGORY, getCategoryDefinition } from '../constants/categories';
import { getCurrentMonthKey, getPreviousMonthKey, isValidMonthInput } from '../lib/date';
import { getNextCategoryStep } from '../lib/expenseFormFlow';
import type { ExpenseDraft } from '../types/ledger';

interface ExpenseFormProps {
  onSubmit: (draft: ExpenseDraft) => Promise<void>;
  onCompleteSequence: () => void;
  onImported: () => Promise<void>;
}

export function ExpenseForm({ onSubmit, onCompleteSequence, onImported }: ExpenseFormProps) {
  const insets = useSafeAreaInsets();
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(DEFAULT_CATEGORY.name);
  const [subcategory, setSubcategory] = useState(DEFAULT_CATEGORY.subcategories[0] ?? '');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const amountInputRef = useRef<TextInput | null>(null);

  const categoryDefinition = getCategoryDefinition(category);
  const footerInset = Math.max(insets.bottom, 12) + 96;
  const contentBottomPadding = keyboardVisible ? 128 : footerInset + 44;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const handleSelectCategory = (nextCategory: string) => {
    const nextDefinition = getCategoryDefinition(nextCategory);
    setCategory(nextCategory);
    setSubcategory(nextDefinition.subcategories[0] ?? '');
  };

  const handleOpenBackupModal = () => {
    Keyboard.dismiss();
    setBackupModalVisible(true);
  };

  const handleImported = async () => {
    await onImported();
    setBackupModalVisible(false);
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

    setSubmitting(true);

    try {
      await onSubmit({
        monthKey,
        amount: normalizedAmount,
        category,
        subcategory: subcategory || null,
        note: note.trim() || null,
      });

      const nextStep = getNextCategoryStep(category);
      setAmount('');
      setNote('');

      if (nextStep.shouldReturnToOverview) {
        Keyboard.dismiss();
        onCompleteSequence();
        return;
      }

      if (nextStep.nextCategory) {
        handleSelectCategory(nextStep.nextCategory);
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
        contentContainerStyle={[styles.content, { paddingBottom: contentBottomPadding }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>Quick Capture</Text>
          <Text style={styles.heroTitle}>记下一笔，让总支出和趋势自动更新。</Text>
        </View>

        <Pressable onPress={handleOpenBackupModal} style={styles.backupEntryButton}>
          <Text style={styles.backupEntryLabel}>账单备份与导入</Text>
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
          <View style={styles.chipGrid}>
            {CATEGORY_DEFINITIONS.map((item) => {
              const active = item.name === category;

              return (
                <Pressable
                  key={item.name}
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
        </View>

        {categoryDefinition.subcategories.length > 0 ? (
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
            ? styles.submitDockKeyboard
            : [styles.submitDock, { paddingBottom: footerInset }]
        }>
        <Pressable
          onPress={handleSubmit}
          style={[styles.submitButton, keyboardVisible && styles.submitButtonKeyboard]}
          disabled={submitting}>
          <Text style={styles.submitButtonText}>{submitting ? '保存中...' : '保存这笔支出'}</Text>
        </Pressable>
      </View>

      <Modal
        visible={backupModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBackupModalVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setBackupModalVisible(false)} />

          <View
            style={[
              styles.modalCardWrap,
              {
                paddingTop: Math.max(insets.top, 20) + 28,
                paddingBottom: Math.max(insets.bottom, 20) + 28,
              },
            ]}>
            <View style={styles.modalCard}>
              <BackupActions onImported={handleImported} />
            </View>
          </View>
        </View>
      </Modal>
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
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(27, 20, 16, 0.42)',
  },
  modalCardWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    borderRadius: 32,
    overflow: 'hidden',
  },
});
