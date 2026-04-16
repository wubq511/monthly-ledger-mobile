import { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  type KeyboardEvent,
  Modal,
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

import { BackupActions } from './BackupActions';
import { BudgetSettingsCard } from './BudgetSettingsCard';
import { CategoryManagerModal } from './CategoryManagerModal';
import { parseBudgetAmountInput } from '../lib/budgetInput';
import { formatMonthLabel } from '../lib/date';
import { getKeyboardInset } from '../lib/expenseFormLayout';
import type {
  BudgetSettings,
  CategoryRecord,
  CategoryUsageSummary,
  SubcategoryUsageSummary,
} from '../types/ledger';

type BudgetEditorState =
  | { mode: 'default'; title: string; initialValue: string; confirmLabel: string }
  | { mode: 'month'; monthKey: string; title: string; initialValue: string; confirmLabel: string };

interface LedgerManagementHubModalProps {
  visible: boolean;
  monthKey: string;
  categories: CategoryRecord[];
  categoriesLoading: boolean;
  budgetSettings: BudgetSettings;
  budgetLoading: boolean;
  budgetError: string | null;
  onClose: () => void;
  onImported: () => Promise<void>;
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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function LedgerManagementHubModal({
  visible,
  monthKey,
  categories,
  categoriesLoading,
  budgetSettings,
  budgetLoading,
  budgetError,
  onClose,
  onImported,
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
}: LedgerManagementHubModalProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editor, setEditor] = useState<BudgetEditorState | null>(null);
  const [editorValue, setEditorValue] = useState('');
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [editorDockHeight, setEditorDockHeight] = useState(0);

  useEffect(() => {
    if (!visible) {
      setCategoryModalVisible(false);
      setEditor(null);
      setEditorValue('');
      setBusyLabel(null);
      setKeyboardInset(0);
      setEditorDockHeight(0);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

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
  }, [visible, windowHeight]);

  const closeModal = () => {
    if (busyLabel) {
      return;
    }

    setCategoryModalVisible(false);
    setEditor(null);
    setEditorValue('');
    onClose();
  };

  const openDefaultBudgetEditor = () => {
    setEditor({
      mode: 'default',
      title: '修改默认月预算',
      initialValue: budgetSettings.defaultBudget === null ? '' : String(budgetSettings.defaultBudget),
      confirmLabel: '正在保存默认预算...',
    });
    setEditorValue(budgetSettings.defaultBudget === null ? '' : String(budgetSettings.defaultBudget));
  };

  const openMonthBudgetEditor = () => {
    const initialValue =
      budgetSettings.monthlyBudgets[monthKey] !== undefined
        ? String(budgetSettings.monthlyBudgets[monthKey])
        : budgetSettings.defaultBudget !== null
          ? String(budgetSettings.defaultBudget)
          : '';

    setEditor({
      mode: 'month',
      monthKey,
      title: `设置 ${formatMonthLabel(monthKey)} 预算`,
      initialValue,
      confirmLabel: '正在保存本月预算...',
    });
    setEditorValue(initialValue);
  };

  const runEditorAction = async () => {
    if (!editor) {
      return;
    }

    const amount = parseBudgetAmountInput(editorValue);

    if (amount === null) {
      Alert.alert('预算无效', '请输入大于 0 的预算金额。');
      return;
    }

    setBusyLabel(editor.confirmLabel);

    try {
      if (editor.mode === 'default') {
        await onSetDefaultBudget(amount);
      } else {
        await onSetMonthlyBudgetOverride(editor.monthKey, amount);
      }

      setEditor(null);
      setEditorValue('');
    } catch (error) {
      Alert.alert('保存失败', getErrorMessage(error, '预算保存失败'));
    } finally {
      setBusyLabel(null);
    }
  };

  const handleResetMonthBudget = () => {
    Alert.alert(
      '恢复默认预算？',
      `${formatMonthLabel(monthKey)} 会改回跟随默认预算，不再保留单独预算。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '恢复默认',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyLabel('正在恢复默认预算...');

              try {
                await onClearMonthlyBudgetOverride(monthKey);
              } catch (error) {
                Alert.alert('恢复失败', getErrorMessage(error, '恢复默认预算失败'));
              } finally {
                setBusyLabel(null);
              }
            })();
          },
        },
      ]
    );
  };

  const handleImported = async () => {
    await Promise.all([onImported(), onRefreshBudgetSettings()]);
  };

  const editorBottomOffset = keyboardInset > 0 ? keyboardInset + 12 : Math.max(insets.bottom, 20) + 12;
  const contentBottomPadding = editor ? editorDockHeight + 30 : Math.max(insets.bottom, 20) + 28;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeModal}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={closeModal} />

        <View
          style={[
            styles.wrap,
            {
              paddingTop: Math.max(insets.top, 18) + 12,
              paddingBottom: Math.max(insets.bottom, 20) + 12,
            },
          ]}>
          <View style={styles.card}>
            <View style={styles.header}>
              <View style={styles.headerTextGroup}>
                <Text style={styles.eyebrow}>Ledger Studio</Text>
                <Text style={styles.title}>账本设置</Text>
                <Text style={styles.body}>把预算、分类和备份入口收在同一个面板里。</Text>
              </View>

              <Pressable onPress={closeModal} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>关闭</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[styles.content, { paddingBottom: contentBottomPadding }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <BudgetSettingsCard
                monthKey={monthKey}
                settings={budgetSettings}
                loading={budgetLoading}
                error={budgetError}
                statusText={busyLabel}
                onEditDefaultBudget={openDefaultBudgetEditor}
                onEditMonthBudget={openMonthBudgetEditor}
                onResetMonthBudget={handleResetMonthBudget}
              />

              <View style={styles.categoryEntryCard}>
                <Text style={styles.sectionEyebrow}>Category Studio</Text>
                <Text style={styles.sectionTitle}>分类管理</Text>
                <Text style={styles.sectionBody}>
                  继续沿用当前的大类 / 细分管理与拖拽排序体验，从这里进入即可。
                </Text>
                <Pressable
                  onPress={() => setCategoryModalVisible(true)}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
                  <Text style={styles.primaryButtonText}>打开分类管理</Text>
                </Pressable>
              </View>

              <BackupActions onImported={handleImported} />
            </ScrollView>
          </View>
        </View>

        {editor ? (
          <Pressable
            style={styles.editorBackdrop}
            disabled={Boolean(busyLabel)}
            onPress={() => {
              if (busyLabel) {
                return;
              }

              setEditor(null);
              setEditorValue('');
            }}
          />
        ) : null}

        {editor ? (
          <View style={[styles.editorDock, { bottom: editorBottomOffset }]} pointerEvents="box-none">
            <View
              style={styles.editorSheet}
              onLayout={(event) => {
                const nextHeight = Math.ceil(event.nativeEvent.layout.height);
                if (nextHeight !== editorDockHeight) {
                  setEditorDockHeight(nextHeight);
                }
              }}>
              <Text style={styles.editorTitle}>{editor.title}</Text>
              <TextInput
                value={editorValue}
                onChangeText={setEditorValue}
                placeholder="请输入预算金额"
                placeholderTextColor="#9B8677"
                keyboardType="decimal-pad"
                autoFocus
                style={styles.editorInput}
              />
              <View style={styles.editorActions}>
                <Pressable onPress={() => setEditor(null)} style={styles.editorSecondaryButton}>
                  <Text style={styles.editorSecondaryText}>取消</Text>
                </Pressable>
                <Pressable onPress={() => void runEditorAction()} style={styles.editorPrimaryButton}>
                  <Text style={styles.editorPrimaryText}>保存</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        <CategoryManagerModal
          visible={categoryModalVisible}
          loading={categoriesLoading}
          categories={categories}
          onClose={() => setCategoryModalVisible(false)}
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(22, 17, 14, 0.48)',
  },
  wrap: {
    flex: 1,
    paddingHorizontal: 16,
  },
  card: {
    flex: 1,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#DDCCBE',
    backgroundColor: '#F6EFE7',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  headerTextGroup: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#9A5E3E',
  },
  title: {
    fontSize: 26,
    lineHeight: 30,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: '#6E5C50',
  },
  closeButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#F3E9DE',
  },
  closeButtonText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#5E493E',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 14,
  },
  categoryEntryCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E4D5C8',
    backgroundColor: '#FBF7F1',
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 10,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#9A5E3E',
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: '#6E5C50',
  },
  primaryButton: {
    borderRadius: 18,
    backgroundColor: '#231B16',
    paddingHorizontal: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonPressed: {
    opacity: 0.86,
  },
  primaryButtonText: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#FBF7F1',
  },
  editorDock: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 2,
  },
  editorBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    backgroundColor: 'rgba(22, 17, 14, 0.18)',
  },
  editorSheet: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E5D5C6',
    backgroundColor: '#FFFDFC',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 12,
    shadowColor: '#20130D',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  editorTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  editorInput: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DDCCBE',
    backgroundColor: '#FBF7F1',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#231B16',
  },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  editorSecondaryButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DDCCBE',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#FBF7F1',
  },
  editorSecondaryText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#5E493E',
  },
  editorPrimaryButton: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: '#231B16',
  },
  editorPrimaryText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#FBF7F1',
  },
});
