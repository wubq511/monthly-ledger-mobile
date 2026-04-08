import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getCategoryDefinition } from '../constants/categories';
import { formatCurrency } from '../lib/format';
import type { CategoryMonthRankItem, CategoryTotal } from '../lib/ledgerSummary';

export function CategoryRankingList({
  title,
  body,
  items,
  emptyTitle,
  emptyBody,
}: {
  title: string;
  body?: string;
  items: CategoryTotal[];
  emptyTitle: string;
  emptyBody: string;
}) {
  if (items.length === 0) {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{title}</Text>
        {body ? <Text style={styles.panelBody}>{body}</Text> : null}
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptyBody}>{emptyBody}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      {body ? <Text style={styles.panelBody}>{body}</Text> : null}

      <View style={styles.list}>
        {items.map((item, index) => (
          <View key={item.name} style={styles.rankRow}>
            <View style={[styles.rankBadge, { backgroundColor: item.color }]}>
              <Text style={styles.rankBadgeText}>{index + 1}</Text>
            </View>

            <View style={styles.rankMain}>
              <View style={styles.rankHeader}>
                <Text style={styles.rankTitle}>{item.name}</Text>
                <Text style={styles.rankValue}>{formatCurrency(item.total)}</Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${Math.max(item.ratio * 100, 8)}%`,
                      backgroundColor: item.color,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function CategoryMonthRankingCard({
  selectedCategory,
  categories,
  rankingMap,
  onSelectCategory,
}: {
  selectedCategory: string | null;
  categories: string[];
  rankingMap: Record<string, CategoryMonthRankItem[]>;
  onSelectCategory: (category: string) => void;
}) {
  if (categories.length === 0 || !selectedCategory) {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>同分类跨月排名</Text>
      </View>
    );
  }

  const rows = rankingMap[selectedCategory] ?? [];

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>同分类跨月排名</Text>

      <View style={styles.chipWrap}>
        {categories.map((category) => {
          const active = category === selectedCategory;
          const color = getCategoryDefinition(category).color;

          return (
            <Pressable
              key={category}
              onPress={() => onSelectCategory(category)}
              style={[
                styles.categoryChip,
                active && { backgroundColor: color, borderColor: color },
              ]}>
              <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                {category}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.list}>
        {rows.map((row, index) => (
          <View key={`${selectedCategory}-${row.monthKey}`} style={styles.monthRow}>
            <View style={styles.monthMeta}>
              <Text style={styles.monthBadge}>{index + 1}</Text>
              <Text style={styles.monthTitle}>{row.label}</Text>
            </View>
            <Text style={styles.monthValue}>{formatCurrency(row.total)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E4D5C8',
    backgroundColor: '#FBF7F1',
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  panelTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  panelBody: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: '#7E6C61',
  },
  list: {
    gap: 10,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#FFF7EF',
  },
  rankMain: {
    flex: 1,
    gap: 8,
  },
  rankHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  rankTitle: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  rankValue: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#5E4D43',
  },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E9DED4',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  emptyBlock: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EEE2D7',
    backgroundColor: '#FFFCF8',
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: '#7E6C61',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E4D5C8',
    backgroundColor: '#FFFCF8',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryChipText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#5E4D43',
  },
  categoryChipTextActive: {
    color: '#FFF7EF',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EEE2D7',
    backgroundColor: '#FFFCF8',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  monthMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthBadge: {
    width: 24,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#A16A52',
  },
  monthTitle: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  monthValue: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
});
