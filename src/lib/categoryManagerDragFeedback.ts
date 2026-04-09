export type CategoryManagerDragFeedbackKind = 'category' | 'subcategory';

interface CategoryManagerDragFeedback {
  liftOffset: number;
  shadowElevation: number;
  shadowOpacity: number;
  shadowRadius: number;
}

const CATEGORY_MANAGER_DRAG_FEEDBACK: Record<
  CategoryManagerDragFeedbackKind,
  CategoryManagerDragFeedback
> = {
  category: {
    liftOffset: 4,
    shadowElevation: 4,
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  subcategory: {
    liftOffset: 2,
    shadowElevation: 3,
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
};

export function getCategoryManagerDragFeedback(kind: CategoryManagerDragFeedbackKind) {
  return CATEGORY_MANAGER_DRAG_FEEDBACK[kind];
}
