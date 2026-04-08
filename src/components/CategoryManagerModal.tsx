import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { moveItem } from '../lib/categoryReorder';
import type {
  CategoryRecord,
  CategoryUsageSummary,
  SubcategoryUsageSummary,
} from '../types/ledger';

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

type DragKind = 'category' | 'subcategory';

interface DragFrame {
  id: string;
  pageY: number;
  height: number;
}

interface DragState {
  kind: DragKind;
  activeId: string;
  categoryId: string | null;
  ids: string[];
  frames: DragFrame[];
  targetIndex: number;
}

interface PendingDrag {
  kind: DragKind;
  activeId: string;
  categoryId: string | null;
  startPageY: number;
}

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

function measureFrame(id: string, view: View | null): Promise<DragFrame | null> {
  return new Promise((resolve) => {
    if (!view || typeof view.measureInWindow !== 'function') {
      resolve(null);
      return;
    }

    view.measureInWindow((_x, pageY, _width, height) => {
      resolve({ id, pageY, height });
    });
  });
}

function resolveTargetIndex(frames: DragFrame[], pageY: number) {
  if (frames.length === 0) {
    return 0;
  }

  for (const [index, frame] of frames.entries()) {
    if (pageY < frame.pageY + frame.height / 2) {
      return index;
    }
  }

  return frames.length - 1;
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
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorValue, setEditorValue] = useState('');
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const categoryRefs = useRef(new Map<string, View | null>());
  const subcategoryRefs = useRef(new Map<string, Map<string, View | null>>());
  const pendingDragRef = useRef<PendingDrag | null>(null);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      setEditor(null);
      setEditorValue('');
      setBusyLabel(null);
      setDragState(null);
      pendingDragRef.current = null;
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, []);

  const clearPendingDrag = () => {
    pendingDragRef.current = null;
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const closeModal = () => {
    if (busyLabel || dragState) {
      return;
    }

    clearPendingDrag();
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

  const activateDrag = async (pendingDrag: PendingDrag) => {
    const ids =
      pendingDrag.kind === 'category'
        ? categories.map((category) => category.id)
        : categories
            .find((category) => category.id === pendingDrag.categoryId)
            ?.subcategories.map((subcategory) => subcategory.id) ?? [];

    const frames = await Promise.all(
      ids.map((id) => {
        if (pendingDrag.kind === 'category') {
          return measureFrame(id, categoryRefs.current.get(id) ?? null);
        }

        const categorySubcategoryRefs = subcategoryRefs.current.get(pendingDrag.categoryId ?? '');
        return measureFrame(id, categorySubcategoryRefs?.get(id) ?? null);
      })
    );

    if (
      !pendingDragRef.current ||
      pendingDragRef.current.activeId !== pendingDrag.activeId ||
      pendingDragRef.current.kind !== pendingDrag.kind
    ) {
      return;
    }

    const resolvedFrames = frames.filter((frame): frame is DragFrame => frame !== null);
    const activeIndex = ids.findIndex((id) => id === pendingDrag.activeId);

    if (resolvedFrames.length === 0 || activeIndex === -1) {
      clearPendingDrag();
      return;
    }

    setDragState({
      kind: pendingDrag.kind,
      activeId: pendingDrag.activeId,
      categoryId: pendingDrag.categoryId,
      ids,
      frames: resolvedFrames,
      targetIndex: resolveTargetIndex(resolvedFrames, pendingDrag.startPageY),
    });
  };

  const beginPendingDrag = (
    kind: DragKind,
    activeId: string,
    categoryId: string | null,
    event: GestureResponderEvent
  ) => {
    if (busyLabel) {
      return;
    }

    clearPendingDrag();

    const pendingDrag: PendingDrag = {
      kind,
      activeId,
      categoryId,
      startPageY: event.nativeEvent.pageY,
    };

    pendingDragRef.current = pendingDrag;
    longPressTimeoutRef.current = setTimeout(() => {
      void activateDrag(pendingDrag);
    }, 220);
  };

  const updateDrag = (event: GestureResponderEvent) => {
    if (dragState) {
      const nextTargetIndex = resolveTargetIndex(dragState.frames, event.nativeEvent.pageY);

      if (nextTargetIndex !== dragState.targetIndex) {
        setDragState({
          ...dragState,
          targetIndex: nextTargetIndex,
        });
      }

      return;
    }

    const pendingDrag = pendingDragRef.current;

    if (pendingDrag && Math.abs(event.nativeEvent.pageY - pendingDrag.startPageY) > 10) {
      clearPendingDrag();
    }
  };

  const finishDrag = async () => {
    clearPendingDrag();

    if (!dragState) {
      return;
    }

    const currentDragState = dragState;
    setDragState(null);

    const currentIndex = currentDragState.ids.findIndex((id) => id === currentDragState.activeId);

    if (currentIndex === -1 || currentIndex === currentDragState.targetIndex) {
      return;
    }

    const nextIds = moveItem(currentDragState.ids, currentIndex, currentDragState.targetIndex);
    setBusyLabel(currentDragState.kind === 'category' ? '正在更新大类顺序...' : '正在更新细分顺序...');

    try {
      if (currentDragState.kind === 'category') {
        await onReorderCategories(nextIds);
      } else if (currentDragState.categoryId) {
        await onReorderSubcategories(currentDragState.categoryId, nextIds);
      }
    } catch (error) {
      Alert.alert('调整失败', getErrorMessage(error, '分类顺序更新失败'));
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

  const handleDeleteSubcategory = async (
    category: CategoryRecord,
    subcategory: CategoryRecord['subcategories'][number]
  ) => {
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

  const dragHelperText = dragState
    ? dragState.kind === 'category'
      ? '拖动大类到目标位置后松手。'
      : '拖动细分到目标位置后松手。'
    : '长按并拖动手柄即可调整顺序。';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeModal}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={closeModal} />

        <View
          style={[
            styles.wrap,
            {
              paddingTop: Math.max(insets.top, 18) + 12,
              paddingBottom: Math.max(insets.bottom, 18) + 16,
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

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {categories.map((category, categoryIndex) => {
                const isCategoryDrag = dragState?.kind === 'category';
                const activeCategoryDragId = isCategoryDrag ? dragState?.activeId : null;
                const currentCategoryIndex = isCategoryDrag
                  ? dragState?.ids.findIndex((id) => id === activeCategoryDragId)
                  : -1;
                const categoryDropTarget =
                  isCategoryDrag &&
                  dragState?.targetIndex === categoryIndex &&
                  currentCategoryIndex !== categoryIndex;

                return (
                  <View
                    key={category.id}
                    ref={(node) => {
                      categoryRefs.current.set(category.id, node);
                    }}
                    collapsable={false}
                    style={[
                      styles.categoryCard,
                      activeCategoryDragId === category.id && styles.categoryCardDragging,
                      categoryDropTarget && styles.categoryCardDropTarget,
                    ]}>
                    <View style={styles.categoryHeader}>
                      <View style={styles.categoryTitleGroup}>
                        <View
                          onTouchStart={(event) => beginPendingDrag('category', category.id, null, event)}
                          onTouchMove={updateDrag}
                          onTouchEnd={() => {
                            void finishDrag();
                          }}
                          onTouchCancel={() => {
                            void finishDrag();
                          }}
                          style={styles.dragHandleTouchArea}>
                          <Text style={styles.categoryHandle}>⋮⋮</Text>
                        </View>

                        <View style={styles.categoryLabelGroup}>
                          <Text style={styles.categoryTitle}>{category.name}</Text>
                          <Text style={styles.categoryMeta}>
                            {category.subcategories.length > 0
                              ? `${category.subcategories.length} 个细分`
                              : '暂无细分'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.categoryActions}>
                        <ActionChip
                          label="新增细分"
                          onPress={() =>
                            openEditor({
                              mode: 'create-subcategory',
                              title: `给“${category.name}”新增细分`,
                              confirmLabel: '正在新增细分...',
                              initialValue: '',
                              categoryId: category.id,
                            })
                          }
                        />
                        <ActionChip
                          label="改名"
                          onPress={() =>
                            openEditor({
                              mode: 'rename-category',
                              title: '修改大类名称',
                              confirmLabel: '正在修改大类...',
                              initialValue: category.name,
                              categoryId: category.id,
                            })
                          }
                        />
                        <ActionChip label="删除" tone="danger" onPress={() => void handleDeleteCategory(category)} />
                      </View>
                    </View>

                    <View style={styles.subcategoryList}>
                      {category.subcategories.length > 0 ? (
                        category.subcategories.map((subcategory, subcategoryIndex) => {
                          const isSubcategoryDrag =
                            dragState?.kind === 'subcategory' && dragState.categoryId === category.id;
                          const activeSubcategoryDragId = isSubcategoryDrag ? dragState?.activeId : null;
                          const currentSubcategoryIndex = isSubcategoryDrag
                            ? dragState?.ids.findIndex((id) => id === activeSubcategoryDragId)
                            : -1;
                          const subcategoryDropTarget =
                            isSubcategoryDrag &&
                            dragState?.targetIndex === subcategoryIndex &&
                            currentSubcategoryIndex !== subcategoryIndex;

                          return (
                            <View
                              key={subcategory.id}
                              ref={(node) => {
                                const categorySubcategoryRefs =
                                  subcategoryRefs.current.get(category.id) ?? new Map<string, View | null>();
                                categorySubcategoryRefs.set(subcategory.id, node);
                                subcategoryRefs.current.set(category.id, categorySubcategoryRefs);
                              }}
                              collapsable={false}
                              style={[
                                styles.subcategoryRow,
                                activeSubcategoryDragId === subcategory.id && styles.subcategoryRowDragging,
                                subcategoryDropTarget && styles.subcategoryRowDropTarget,
                              ]}>
                              <View style={styles.subcategoryContent}>
                                <View
                                  onTouchStart={(event) =>
                                    beginPendingDrag('subcategory', subcategory.id, category.id, event)
                                  }
                                  onTouchMove={updateDrag}
                                  onTouchEnd={() => {
                                    void finishDrag();
                                  }}
                                  onTouchCancel={() => {
                                    void finishDrag();
                                  }}
                                  style={styles.dragHandleTouchArea}>
                                  <Text style={styles.subcategoryHandle}>⋮⋮</Text>
                                </View>
                                <Text style={styles.subcategoryName}>{subcategory.name}</Text>
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
                                      initialValue: subcategory.name,
                                      categoryId: category.id,
                                      subcategoryId: subcategory.id,
                                    })
                                  }
                                />
                                <ActionChip
                                  label="删除"
                                  tone="danger"
                                  compact
                                  onPress={() => void handleDeleteSubcategory(category, subcategory)}
                                />
                              </View>
                            </View>
                          );
                        })
                      ) : (
                        <Text style={styles.subcategoryEmpty}>先给这个大类补一个常用细分。</Text>
                      )}
                    </View>
                  </View>
                );
              })}

              {!loading && categories.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>还没有可用分类</Text>
                  <Text style={styles.emptyBody}>先新增一个大类，记账页就会立刻出现这个选项。</Text>
                </View>
              ) : null}
            </ScrollView>

            {editor ? (
              <View style={styles.editorSheet}>
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
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
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
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 22,
    gap: 12,
  },
  categoryCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E4D5C8',
    backgroundColor: '#FFFDFC',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  categoryCardDragging: {
    borderColor: '#C76439',
    backgroundColor: '#FFF5EE',
    shadowColor: '#8A563A',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  categoryCardDropTarget: {
    borderColor: '#CBA78E',
    borderStyle: 'dashed',
  },
  categoryHeader: {
    gap: 12,
  },
  categoryTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  subcategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 18,
    backgroundColor: '#F7EFE6',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  subcategoryRowDragging: {
    borderWidth: 1,
    borderColor: '#C76439',
    backgroundColor: '#FFF5EE',
  },
  subcategoryRowDropTarget: {
    borderWidth: 1,
    borderColor: '#CBA78E',
    borderStyle: 'dashed',
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
