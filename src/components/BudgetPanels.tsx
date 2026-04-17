import { StyleSheet, Text, View } from 'react-native';

import { formatCurrency } from '../lib/format';
import type { BudgetMonthRow, BudgetSnapshot } from '../lib/ledgerSummary';

type BudgetTone = 'calm' | 'warning' | 'over';

function getBudgetTone(snapshot: BudgetSnapshot): BudgetTone {
  if (snapshot.isOverBudget) {
    return 'over';
  }

  if (snapshot.utilizationRate >= 0.8) {
    return 'warning';
  }

  return 'calm';
}

function getToneColors(tone: BudgetTone, light: boolean) {
  if (light) {
    switch (tone) {
      case 'over':
        return {
          fill: '#FF8E66',
          surface: 'rgba(255, 142, 102, 0.16)',
          border: 'rgba(255, 191, 166, 0.32)',
          text: '#FFF7EF',
          muted: '#FFD9C9',
          track: 'rgba(255, 247, 239, 0.14)',
        };
      case 'warning':
        return {
          fill: '#F1C36C',
          surface: 'rgba(241, 195, 108, 0.16)',
          border: 'rgba(255, 224, 160, 0.32)',
          text: '#FFF7EF',
          muted: '#F8E2BA',
          track: 'rgba(255, 247, 239, 0.14)',
        };
      default:
        return {
          fill: '#9BC98B',
          surface: 'rgba(155, 201, 139, 0.16)',
          border: 'rgba(193, 230, 183, 0.32)',
          text: '#FFF7EF',
          muted: '#D5EDD0',
          track: 'rgba(255, 247, 239, 0.14)',
        };
    }
  }

  switch (tone) {
    case 'over':
      return {
        fill: '#D06038',
        surface: '#FFF1EB',
        border: '#F4C8BB',
        text: '#7A2918',
        muted: '#A65A44',
        track: '#F0DBD2',
      };
    case 'warning':
      return {
        fill: '#CF9A3A',
        surface: '#FFF6E6',
        border: '#F1D6A0',
        text: '#7B5610',
        muted: '#936C24',
        track: '#EBDDBF',
      };
    default:
      return {
        fill: '#6D8B53',
        surface: '#F3F8EE',
        border: '#CFE0C0',
        text: '#3F5A2B',
        muted: '#5F7751',
        track: '#D8E5CE',
      };
  }
}

function formatStatusText(snapshot: BudgetSnapshot) {
  return snapshot.isOverBudget
    ? `超支 ${formatCurrency(snapshot.overspend)}`
    : `结余 ${formatCurrency(snapshot.remaining)}`;
}

export function BudgetMeter({
  budget,
  light = false,
}: {
  budget: BudgetSnapshot;
  light?: boolean;
}) {
  const tone = getBudgetTone(budget);
  const colors = getToneColors(tone, light);
  const progress = Math.min(Math.max(budget.utilizationRate, 0), 1);

  return (
    <View style={[styles.meterWrap, light && styles.meterWrapLight]}>
      <View style={styles.meterHeader}>
        <View style={[styles.statusPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statusPillText, { color: colors.text }]}>{formatStatusText(budget)}</Text>
        </View>
        <Text style={[styles.limitText, { color: colors.muted }]}>预算 {formatCurrency(budget.budgetLimit)}</Text>
      </View>

      <View style={[styles.track, { backgroundColor: colors.track }]}>
        <View style={[styles.fill, { width: `${Math.max(progress * 100, 8)}%`, backgroundColor: colors.fill }]} />
      </View>
    </View>
  );
}

export function BudgetMonthStatusList({
  rows,
}: {
  rows: BudgetMonthRow[];
}) {
  if (rows.length === 0) {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>每月预算状态</Text>
        <Text style={styles.emptyText}>还没有跨月数据，记几个月后这里会出现预算状态。</Text>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>每月预算状态</Text>

      <View style={styles.list}>
        {rows.map((row) => {
          const tone = getBudgetTone(row);
          const colors = getToneColors(tone, false);

          return (
            <View key={row.monthKey} style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowTitle}>{row.label}</Text>
                <Text style={styles.rowMeta}>总支出 {formatCurrency(row.total)}</Text>
              </View>

              <View style={[styles.rowPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.rowPillText, { color: colors.text }]}>{formatStatusText(row)}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function OverspendRankingList({
  rows,
}: {
  rows: BudgetMonthRow[];
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>超支月份排名</Text>

      {rows.length > 0 ? (
        <View style={styles.list}>
          {rows.map((row, index) => (
            <View key={row.monthKey} style={styles.rankRow}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankBadgeText}>{index + 1}</Text>
              </View>

              <View style={styles.rowLeft}>
                <Text style={styles.rowTitle}>{row.label}</Text>
                <Text style={styles.rowMeta}>总支出 {formatCurrency(row.total)}</Text>
              </View>

              <Text style={styles.overspendValue}>{formatCurrency(row.overspend)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>目前还没有超支月份，继续保持。</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  meterWrap: {
    gap: 10,
  },
  meterWrapLight: {
    marginTop: 2,
  },
  meterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusPillText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
  },
  limitText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  track: {
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
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
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EEE2D7',
    backgroundColor: '#FFFCF8',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EEE2D7',
    backgroundColor: '#FFFCF8',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#231B16',
  },
  rankBadgeText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#FFF7EF',
  },
  rowLeft: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  rowMeta: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: '#7E6C61',
  },
  rowPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rowPillText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
  },
  overspendValue: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#A44324',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: '#7E6C61',
  },
});
