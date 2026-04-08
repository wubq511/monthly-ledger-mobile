import type { CategoryDefinition } from '../types/ledger';

export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    name: '饮食',
    color: '#C76439',
    subcategories: ['食堂', '外卖', '下馆子', '零食 / 水果 / 面包'],
  },
  {
    name: '医疗',
    color: '#B44A54',
    subcategories: [],
  },
  {
    name: '日常生活学习用品',
    color: '#60704F',
    subcategories: [],
  },
  {
    name: '服饰',
    color: '#8A5A6B',
    subcategories: [],
  },
  {
    name: '娱乐',
    color: '#4B7A74',
    subcategories: [],
  },
  {
    name: '运动',
    color: '#5B6EE1',
    subcategories: [],
  },
  {
    name: '理发',
    color: '#B07B39',
    subcategories: [],
  },
  {
    name: '保洁',
    color: '#4F928E',
    subcategories: [],
  },
  {
    name: '电费',
    color: '#D0882F',
    subcategories: [],
  },
  {
    name: '话费',
    color: '#8D5FE0',
    subcategories: [],
  },
  {
    name: '洗衣',
    color: '#6F7C9A',
    subcategories: [],
  },
  {
    name: '交通',
    color: '#3A6D9A',
    subcategories: [],
  },
  {
    name: '其他',
    color: '#7E6C61',
    subcategories: [],
  },
];

export const DEFAULT_CATEGORY = CATEGORY_DEFINITIONS[0];
export const CATEGORY_COLOR_PALETTE = CATEGORY_DEFINITIONS.map((item) => item.color);
export const FALLBACK_CATEGORY_COLOR = DEFAULT_CATEGORY.color;

export function getCategoryDefinition(categoryName: string) {
  return CATEGORY_DEFINITIONS.find((item) => item.name === categoryName) ?? DEFAULT_CATEGORY;
}

export function getSeedColorByIndex(index: number) {
  return CATEGORY_COLOR_PALETTE[index % CATEGORY_COLOR_PALETTE.length] ?? FALLBACK_CATEGORY_COLOR;
}
