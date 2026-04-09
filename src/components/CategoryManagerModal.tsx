import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  type KeyboardEvent,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  NestableDraggableFlatList,
  NestableScrollContainer,
  ShadowDecorator,
  useOnCellActiveAnimation,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  buildManagedCategoryCards,
  resolveManagedExpandedCategoryId,
  toggleManagedExpandedCategoryId,
  type ManagedCategoryCard,
} from '../lib/categoryManagerSelection';
import { getCategoryManagerDragFeedback } from '../lib/categoryManagerDragFeedback';
import { getCategoryManagerLayoutMetrics } from '../lib/categoryManagerLayout';
import { getExperimentalLayoutAnimationFlag } from '../lib/draggableListConfig';
import { getKeyboardInset } from '../lib/expenseFormLayout';
import { reorderCategoriesTree, reorderSubcategoriesTree } from '../lib/categoryReorder';
import type {
  CategoryRecord,
  CategoryUsageSummary,
  SubcategoryUsageSummary,
} from '../types/ledger';

type ManagedSubcategory = CategoryRecord['subcategories'][number];
type DragKind = 'category' | 'subcategory';

type EditorState =
  | { mode: 'create-category'; title: string; confirmLabel: string; initialValue: string }
  | {
      mode: 'rename-category';
      title: string;
      confirmLabel: string;
      initialValue: string;
      categoryId: string;
    }
  | {
      mode: 'create-subcategory';
      title: string;
      confirmLabel: string;
      initialValue: string;
      categoryId: string;
    }
  | {
      mode: 'rename-subcategory';
      title: string;
      confirmLabel: string;
      initialValue: string;
      categoryId: string;
      subcategoryId: string;
    };

interface CategoryManagerModalProps {
  visible: boolean;
  loading: boolean;
  categories: CategoryRecord[];
  onClose: () => void;
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

export function CategoryManagerModal({
  visible,
  loading,
  categories,
  onClose,
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
}: CategoryManagerModalProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const enableExperimentalLayoutAnimation = getExperimentalLayoutAnimationFlag(
    globalThis as Parameters<typeof getExperimentalLayoutAnimationFlag>[0]
  );
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorValue, setEditorValue] = useState('');
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [activeDragKind, setActiveDragKind] = useState<DragKind | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [editorDockHeight, setEditorDockHeight] = useState(0);
  const [localCategories, setLocalCategories] = useState<CategoryRecord[]>(categories);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const scrollContainerRef = useRef<any>(null);
  const categoryDragFeedback = getCategoryManagerDragFeedback('category');
  const subcategoryDragFeedback = getCategoryManagerDragFeedback('subcategory');

  useEffect(() => {
    if (visible) {
      setLocalCategories(categories);
      setExpandedCategoryId((currentCategoryId) =>
        resolveManagedExpandedCategoryId(categories, currentCategoryId)
      );
      return;
    }

    setEditor(null);
    setEditorValue('');
    setBusyLabel(null);
    setActiveDragKind(null);
    setLocalCategories(categories);
    setExpandedCategoryId(null);
    setKeyboardInset(0);
    setEditorDockHeight(0);
  }, [categories, visible]);

  useEffect(() => {
    setExpandedCategoryId((currentCategoryId) =>
      resolveManagedExpandedCategoryId(localCategories, currentCategoryId)
    );
  }, [localCategories]);

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

  const managedCategoryCards = buildManagedCategoryCards(localCategories, expandedCategoryId);
  const layoutMetrics = getCategoryManagerLayoutMetrics({
    safeAreaBottom: insets.bottom,
    keyboardInset,
    editorVisible: Boolean(editor),
  });
  const editorOverlayPadding = editor ? editorDockHeight + 20 : 0;

  const closeModal = () => {
    if (busyLabel || activeDragKind) {
      return;
    }

    setEditor(null);
    setEditorValue('');
    onClose();
  };

  const openEditor = (nextEditor: EditorState) => {
    setEditor(nextEditor);
    setEditorValue(nextEditor.initialValue);
  };

  const runEditorAction = async () => {
    if (!editor) {
      return;
    }

    const trimmedValue = editorValue.trim();

    if (!trimmedValue) {
      Alert.alert('名称不能为空', '请输入至少 1 个字符。');
      return;
    }

    setBusyLabel(editor.confirmLabel);

    try {
      if (editor.mode === 'create-category') {
        await onCreateCategory(trimmedValue);
      }

      if (editor.mode === 'rename-category') {
        await onRenameCategory(editor.categoryId, trimmedValue);
      }

      if (editor.mode === 'create-subcategory') {
        await onCreateSubcategory(editor.categoryId, trimmedValue);
      }

      if (editor.mode === 'rename-subcategory') {
        await onRenameSubcategory(editor.subcategoryId, trimmedValue);
      }

      setEditor(null);
      setEditorValue('');
    } catch (error) {
      Alert.alert('保存失败', getErrorMessage(error, '分类保存失败'));
    } finally {
      setBusyLabel(null);
    }
  };

  const handleCategoryDragEnd = async ({
    from,
    to,
  }: {
    data: CategoryRecord[];
    from: number;
    to: number;
  }) => {
    setActiveDragKind(null);

    if (from === to) {
      return;
    }

    const previousCategories = localCategories;
    const nextCategories = reorderCategoriesTree(previousCategories, from, to);
    setLocalCategories(nextCategories);
    setBusyLabel('正在更新大类顺序...');

    try {
      await onReorderCategories(nextCategories.map((item) => item.id));
    } catch (error) {
      setLocalCategories(previousCategories);
      Alert.alert('调整失败', getErrorMessage(error, '分类顺序更新失败'));
    } finally {
      setBusyLabel(null);
    }
  };

  const handleSubcategoryDragEnd = async (
    categoryId: string,
    from: number,
    to: number
  ) => {
    setActiveDragKind(null);

    if (from === to) {
      return;
    }

    const previousCategories = localCategories;
    const nextCategories = reorderSubcategoriesTree(previousCategories, categoryId, from, to);
    const reorderedSubcategories =
      nextCategories.find((category) => category.id === categoryId)?.subcategories ?? [];

    setLocalCategories(nextCategories);
    setBusyLabel('正在更新细分顺序...');

    try {
      await onReorderSubcategories(
        categoryId,
        reorderedSubcategories.map((subcategory) => subcategory.id)
      );
    } catch (error) {
      setLocalCategories(previousCategories);
      Alert.alert('调整失败', getErrorMessage(error, '细分顺序更新失败'));
    } finally {
      setBusyLabel(null);
    }
  };

  const handleDeleteCategory = async (category: CategoryRecord) => {
    const usage = await getCategoryUsageSummary(category.id);
    const body =
      usage.expenseCount > 0
        ? `已有 ${usage.expenseCount} 条历史账单使用“${category.name}”。删除后不会删除历史账单，旧记录仍保留原有分类文字，只是不再出现在可选项中。`
        : `删除后，“${category.name}”将不再出现在可选项中。`;

    Alert.alert('删除这个大类？', body, [
      { text: '取消', style: 'cancel' },
      {
        text: '确认删除',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusyLabel('正在删除大类...');

            try {
              await onDeleteCategory(category.id);
            } catch (error) {
              Alert.alert('删除失败', getErrorMessage(error, '删除大类失败'));
            } finally {
              setBusyLabel(null);
            }
          })();
        },
      },
    ]);
  };

  const handleDeleteSubcategory = async (category: CategoryRecord, subcategory: ManagedSubcategory) => {
    const usage = await getSubcategoryUsageSummary(subcategory.id);
    const body =
      usage.expenseCount > 0
        ? `已有 ${usage.expenseCount} 条历史账单使用“${category.name} / ${subcategory.name}”。删除后不会删除历史账单，旧记录仍保留原有分类文字。`
        : `删除后，“${subcategory.name}”将不再出现在“${category.name}”的细分选项中。`;

    Alert.alert('删除这个细分？', body, [
      { text: '取消', style: 'cancel' },
      {
        text: '确认删除',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusyLabel('正在删除细分...');

            try {
              await onDeleteSubcategory(subcategory.id);
            } catch (error) {
              Alert.alert('删除失败', getErrorMessage(error, '删除细分失败'));
            } finally {
              setBusyLabel(null);
            }
          })();
        },
      },
    ]);
  };

  const renderSubcategoryItem =
    (category: CategoryRecord) =>
    ({ item, drag, isActive }: RenderItemParams<ManagedSubcategory>) =>
      (
        <LiftDecorator liftOffset={subcategoryDragFeedback.liftOffset}>
          <ShadowDecorator
            elevation={subcategoryDragFeedback.shadowElevation}
            opacity={subcategoryDragFeedback.shadowOpacity}
            radius={subcategoryDragFeedback.shadowRadius}>
            <View style={[styles.subcategoryRow, isActive && styles.subcategoryRowActive]}>
              <View style={styles.subcategoryContent}>
                <TouchableOpacity
                  onLongPress={drag}
                  delayLongPress={180}
                  activeOpacity={0.85}
                  disabled={Boolean(busyLabel) || Boolean(editor) || isActive}
                  style={styles.dragHandleTouchArea}>
                  <Text style={styles.subcategoryHandle}>⋮⋮</Text>
                </TouchableOpacity>
                <Text style={styles.subcategoryName}>{item.name}</Text>
              </View>
              <View style={styles.subcategoryActions}>
                <ActionChip
                  label="改名"
                  compact
                  onPress={() =>
                    openEditor({
                      mode: 'rename-subcategory',
                      title: '修改细分名称',
                      confirmLabel: '正在修改细分...',
                      initialValue: item.name,
                      categoryId: category.id,
                      subcategoryId: item.id,
                    })
                  }
                />
                <ActionChip
                  label="删除"
                  tone="danger"
                  compact
                  onPress={() => void handleDeleteSubcategory(category, item)}
                />
              </View>
            </View>
          </ShadowDecorator>
        </LiftDecorator>
      );

  const renderCategoryItem = ({ item, drag, isActive }: RenderItemParams<ManagedCategoryCard>) => {
    const canToggleSubcategories = item.subcategories.length > 0;

    return (
      <LiftDecorator liftOffset={categoryDragFeedback.liftOffset}>
        <ShadowDecorator
          elevation={categoryDragFeedback.shadowElevation}
          opacity={categoryDragFeedback.shadowOpacity}
          radius={categoryDragFeedback.shadowRadius}>
          <View
            style={[
              styles.categoryCard,
              item.isExpanded && styles.categoryCardExpanded,
              isActive && styles.categoryCardActive,
            ]}>
            <View style={styles.categoryHeader}>
              <View style={styles.categoryTitleGroup}>
                <TouchableOpacity
                  onLongPress={drag}
                  delayLongPress={180}
                  activeOpacity={0.85}
                  disabled={Boolean(busyLabel) || Boolean(editor) || isActive}
                  style={styles.dragHandleTouchArea}>
                  <Text style={styles.categoryHandle}>⋮⋮</Text>
                </TouchableOpacity>

                <View style={styles.categoryLabelGroup}>
                  <Text style={styles.categoryTitle}>{item.name}</Text>
                  <Text style={styles.categoryMeta}>
                    {item.subcategories.length > 0 ? `${item.subcategories.length} 个细分` : '暂无细分'}
                  </Text>
                </View>
              </View>

              <View style={styles.categoryActions}>
                {canToggleSubcategories ? (
                  <ActionChip
                    label={item.isExpanded ? '收起细分' : '展开细分'}
                    onPress={() =>
                      setExpandedCategoryId((currentCategoryId) =>
                        toggleManagedExpandedCategoryId(currentCategoryId, item.id)
                      )
                    }
                  />
                ) : null}
                <ActionChip
                  label="新增细分"
                  onPress={() => {
                    setExpandedCategoryId(item.id);
                    openEditor({
                      mode: 'create-subcategory',
                      title: `给“${item.name}”新增细分`,
                      confirmLabel: '正在新增细分...',
                      initialValue: '',
                      categoryId: item.id,
                    });
                  }}
                />
                <ActionChip
                  label="改名"
                  onPress={() =>
                    openEditor({
                      mode: 'rename-category',
                      title: '修改大类名称',
                      confirmLabel: '正在修改大类...',
                      initialValue: item.name,
                      categoryId: item.id,
                    })
                  }
                />
                <ActionChip label="删除" tone="danger" onPress={() => void handleDeleteCategory(item)} />
              </View>
            </View>

            {item.isExpanded ? (
              <View style={styles.subcategorySection}>
                <View style={styles.subcategorySectionHeader}>
                  <Text style={styles.subcategorySectionEyebrow}>Subcategories</Text>
                  <Text style={styles.subcategorySectionTitle}>{item.name} 的细分</Text>
                  <Text style={styles.subcategorySectionBody}>
                    长按手柄即可拖动，顺序会立刻保存。
                  </Text>
                </View>

                {item.visibleSubcategories.length > 0 ? (
                  <NestableDraggableFlatList
                    data={item.visibleSubcategories}
                    keyExtractor={(subcategory) => subcategory.id}
                    renderItem={renderSubcategoryItem(item)}
                    onDragBegin={() => setActiveDragKind('subcategory')}
                    onRelease={() => setActiveDragKind(null)}
                    onDragEnd={({ from, to }) => {
                      void handleSubcategoryDragEnd(item.id, from, to);
                    }}
                    dragItemOverflow
                    activationDistance={20}
                    autoscrollThreshold={32}
                    autoscrollSpeed={120}
                    enableLayoutAnimationExperimental={enableExperimentalLayoutAnimation}
                    contentContainerStyle={styles.subcategoryList}
                    showsVerticalScrollIndicator={false}
                    scrollEnabled={false}
                    simultaneousHandlers={scrollContainerRef}
                  />
                ) : (
                  <Text style={styles.subcategoryEmpty}>先给这个大类补一个常用细分。</Text>
                )}
              </View>
            ) : null}
          </View>
        </ShadowDecorator>
      </LiftDecorator>
    );
  };

  const dragHelperText =
    activeDragKind === 'category'
      ? '正在拖动大类，松手后会立即保存顺序。'
      : activeDragKind === 'subcategory'
        ? '正在拖动细分，列表会实时交换位置。'
        : '长按手柄拖动即可调整顺序。';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeModal}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={styles.root}>
          <Pressable style={styles.backdrop} onPress={closeModal} />

          <View
            style={[
              styles.wrap,
              {
                paddingTop: Math.max(insets.top, 18) + 12,
                paddingBottom: layoutMetrics.modalBottomInset,
              },
            ]}>
            <View style={styles.card}>
            <View style={styles.header}>
              <View style={styles.headerTextGroup}>
                <Text style={styles.eyebrow}>Category Studio</Text>
                <Text style={styles.title}>分类管理</Text>
              </View>

              <Pressable onPress={closeModal} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>关闭</Text>
              </Pressable>
            </View>

            <View style={styles.toolbar}>
              <Pressable
                onPress={() =>
                  openEditor({
                    mode: 'create-category',
                    title: '新增大类',
                    confirmLabel: '正在新增大类...',
                    initialValue: '',
                  })
                }
                style={styles.primaryAction}>
                <Text style={styles.primaryActionText}>新增大类</Text>
              </Pressable>

              <Text style={styles.helperText}>{dragHelperText}</Text>
            </View>

            {busyLabel ? (
              <View style={styles.statusRow}>
                <ActivityIndicator size="small" color="#9A5E3E" />
                <Text style={styles.statusText}>{busyLabel}</Text>
              </View>
            ) : null}

            {localCategories.length > 0 ? (
              <NestableScrollContainer
                ref={scrollContainerRef}
                style={styles.scroll}
                contentContainerStyle={[
                  styles.scrollContainerContent,
                  editor ? { paddingBottom: 22 + editorOverlayPadding } : null,
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}>
                <NestableDraggableFlatList
                  data={managedCategoryCards}
                  keyExtractor={(category) => category.id}
                  renderItem={renderCategoryItem}
                  onDragBegin={() => setActiveDragKind('category')}
                  onRelease={() => setActiveDragKind(null)}
                  onDragEnd={({ from, to }) => {
                    void handleCategoryDragEnd({ from, to, data: localCategories });
                  }}
                  dragItemOverflow
                  activationDistance={20}
                  autoscrollThreshold={48}
                  autoscrollSpeed={160}
                  enableLayoutAnimationExperimental={enableExperimentalLayoutAnimation}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent}
                  simultaneousHandlers={scrollContainerRef}
                />
              </NestableScrollContainer>
            ) : !loading ? (
              <View style={[styles.emptyWrap, editor ? { paddingBottom: editorOverlayPadding } : null]}>
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>还没有可用分类</Text>
                  <Text style={styles.emptyBody}>先新增一个大类，记账页就会立刻出现这个选项。</Text>
                </View>
              </View>
            ) : null}

            </View>
          </View>

          {editor ? (
            <View
              style={[styles.editorDock, { bottom: layoutMetrics.editorBottomOffset }]}
              pointerEvents="box-none">
              <View
                style={styles.editorSheetFloating}
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
                  placeholder="请输入名称"
                  placeholderTextColor="#9B8677"
                  style={styles.editorInput}
                  autoFocus
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
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function LiftDecorator({
  liftOffset,
  children,
}: {
  liftOffset: number;
  children: ReactNode;
}) {
  const { onActiveAnim } = useOnCellActiveAnimation();
  const style = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(onActiveAnim.value, [0, 1], [0, -liftOffset]),
      },
    ],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

function ActionChip({
  label,
  onPress,
  tone = 'default',
  compact = false,
}: {
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.actionChip,
        compact && styles.actionChipCompact,
        tone === 'danger' && styles.actionChipDanger,
      ]}>
      <Text
        style={[
          styles.actionChipText,
          compact && styles.actionChipTextCompact,
          tone === 'danger' && styles.actionChipTextDanger,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
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
    backgroundColor: '#FBF7F1',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 12,
  },
  headerTextGroup: {
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
  toolbar: {
    paddingHorizontal: 18,
    gap: 10,
  },
  primaryAction: {
    borderRadius: 18,
    backgroundColor: '#231B16',
    alignItems: 'center',
    paddingVertical: 14,
  },
  primaryActionText: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#FBF7F1',
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: '#806D62',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  statusText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#9A5E3E',
  },
  scroll: {
    flex: 1,
    marginTop: 12,
  },
  scrollContainerContent: {
    paddingHorizontal: 18,
    paddingBottom: 22,
  },
  scrollContent: {
    gap: 0,
  },
  emptyWrap: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  categoryCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E4D5C8',
    backgroundColor: '#FFFDFC',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    marginBottom: 12,
  },
  categoryCardExpanded: {
    borderColor: '#CBA78E',
    backgroundColor: '#FFF8F1',
  },
  categoryCardActive: {
    borderColor: '#C76439',
    backgroundColor: '#FFF5EE',
  },
  categoryHeader: {
    gap: 12,
  },
  categoryTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dragHandleTouchArea: {
    width: 28,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryHandle: {
    fontSize: 18,
    color: '#A78876',
  },
  categoryLabelGroup: {
    flex: 1,
    gap: 3,
  },
  categoryTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  categoryMeta: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: '#806D62',
  },
  categoryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subcategoryList: {
    gap: 8,
  },
  subcategorySection: {
    marginTop: 4,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E4D5C8',
    backgroundColor: '#FFFDFC',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  subcategorySectionHeader: {
    gap: 4,
    marginBottom: 12,
  },
  subcategorySectionEyebrow: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: '#9A5E3E',
  },
  subcategorySectionTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  subcategorySectionBody: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: '#806D62',
  },
  subcategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 18,
    backgroundColor: '#F7EFE6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  subcategoryRowActive: {
    borderWidth: 1,
    borderColor: '#C76439',
    backgroundColor: '#FFF5EE',
  },
  subcategoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  subcategoryHandle: {
    fontSize: 16,
    color: '#A78876',
  },
  subcategoryName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#3A2D27',
  },
  subcategoryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  subcategoryEmpty: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: '#8A7567',
  },
  actionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DECDBF',
    backgroundColor: '#FBF7F1',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionChipCompact: {
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  actionChipDanger: {
    borderColor: '#E2C0BB',
    backgroundColor: '#FFF4F3',
  },
  actionChipText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#5C4A3F',
  },
  actionChipTextCompact: {
    fontSize: 11,
  },
  actionChipTextDanger: {
    color: '#A1464E',
  },
  emptyCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E6D8CB',
    backgroundColor: '#FBF7F1',
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: '#7E6C61',
  },
  editorDock: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  editorSheetFloating: {
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
  editorSheet: {
    borderTopWidth: 1,
    borderColor: '#E5D5C6',
    backgroundColor: '#FFFDFC',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 12,
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
