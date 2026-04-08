import { Suspense, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SQLiteProvider } from 'expo-sqlite';
import { useFonts } from 'expo-font';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BudgetMeter, BudgetMonthStatusList, OverspendRankingList } from './src/components/BudgetPanels';
import { MonthlyLineChart } from './src/components/Charts';
import { ExpenseForm } from './src/components/ExpenseForm';
import { CategoryMonthRankingCard, CategoryRankingList } from './src/components/RankingLists';
import { getCategoryDefinition } from './src/constants/categories';
import { initializeDatabase } from './src/lib/database';
import { formatMonthLabel, formatShortMonthLabel, getCurrentMonthKey, shiftMonth } from './src/lib/date';
import { formatCurrency } from './src/lib/format';
import { buildLedgerSummary, MONTHLY_BUDGET_LIMIT, type LedgerSummary } from './src/lib/ledgerSummary';
import { useLedgerData } from './src/hooks/useLedgerData';
import type { ExpenseDraft, ExpenseEntry, TabKey } from './src/types/ledger';

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  if (!fontsLoaded) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="monthly-ledger.db" onInit={initializeDatabase} useSuspense>
        <Suspense fallback={<LoadingScreen />}>
          <LedgerApp />
        </Suspense>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}

function LedgerApp() {
  const insets = useSafeAreaInsets();
  const { entries, loading, error, addEntry, removeEntry, refresh } = useLedgerData();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [selectedRankingCategory, setSelectedRankingCategory] = useState<string | null>(null);

  const summary = buildLedgerSummary(entries, selectedMonth, formatShortMonthLabel);
  const rankingCategories = Object.keys(summary.categoryMonthRanking);
  const rankingCategoryKey = rankingCategories.join('|');
  const hasSelectedRankingCategory = selectedRankingCategory
    ? rankingCategories.includes(selectedRankingCategory)
    : false;

  useEffect(() => {
    if (rankingCategories.length === 0) {
      if (selectedRankingCategory !== null) {
        setSelectedRankingCategory(null);
      }
      return;
    }

    if (!selectedRankingCategory || !hasSelectedRankingCategory) {
      setSelectedRankingCategory(summary.defaultCategoryRankingName);
    }
  }, [hasSelectedRankingCategory, rankingCategoryKey, selectedRankingCategory, summary.defaultCategoryRankingName]);

  const handleAddExpense = async (draft: ExpenseDraft) => {
    await addEntry(draft);
    setSelectedMonth(draft.monthKey);
  };

  const handleDeleteExpense = (entry: ExpenseEntry) => {
    Alert.alert(
      '删除这笔记录？',
      `${entry.category} ${formatCurrency(entry.amount)} · ${formatMonthLabel(entry.monthKey)}`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            void removeEntry(entry.id).catch((deleteError) => {
              const message =
                deleteError instanceof Error ? deleteError.message : '删除失败，请稍后再试。';
              Alert.alert('删除失败', message);
            });
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.appShell}>
        {loading ? <LoadingOverlay /> : null}

        {activeTab === 'overview' ? (
          <OverviewScreen
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            summary={summary}
            onDelete={handleDeleteExpense}
          />
        ) : null}

        {activeTab === 'add' ? (
          <ExpenseForm
            onSubmit={handleAddExpense}
            onCompleteSequence={() => setActiveTab('overview')}
            onImported={refresh}
          />
        ) : null}

        {activeTab === 'trends' ? (
          <TrendsScreen
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            summary={summary}
            rankingCategories={rankingCategories}
            selectedRankingCategory={selectedRankingCategory}
            onSelectRankingCategory={setSelectedRankingCategory}
          />
        ) : null}

        <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {TAB_ITEMS.map((item) => {
            const active = item.key === activeTab;

            return (
              <Pressable
                key={item.key}
                onPress={() => setActiveTab(item.key)}
                style={[styles.tabButton, active && styles.tabButtonActive]}>
                <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{item.icon}</Text>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>数据库读取异常：{error}</Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function OverviewScreen({
  selectedMonth,
  onMonthChange,
  summary,
  onDelete,
}: {
  selectedMonth: string;
  onMonthChange: (monthKey: string) => void;
  summary: LedgerSummary;
  onDelete: (entry: ExpenseEntry) => void;
}) {
  const budgetStatus = summary.selectedBudget.isOverBudget
    ? `超支 ${formatCurrency(summary.selectedBudget.overspend)}`
    : `结余 ${formatCurrency(summary.selectedBudget.remaining)}`;
  const netBudgetStatus =
    summary.netBudgetBalance >= 0
      ? `净结余 ${formatCurrency(summary.netBudgetBalance)}`
      : `净超支 ${formatCurrency(Math.abs(summary.netBudgetBalance))}`;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={['#171311', '#37271E', '#744937']}
        start={{ x: 0.04, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroPanel}>
        <Text style={styles.heroKicker}>MONTH BUDGET</Text>
        <MonthSwitcher monthKey={selectedMonth} onChange={onMonthChange} light />
        <Text style={styles.heroTotal}>{formatCurrency(summary.selectedTotal)}</Text>

        <BudgetMeter budget={summary.selectedBudget} budgetLimit={MONTHLY_BUDGET_LIMIT} light />

        <View style={styles.metricGrid}>
          <MetricChip label="本月预算状态" value={budgetStatus} />
          <MetricChip label="累计超支" value={formatCurrency(summary.totalOverspend)} />
          <MetricChip
            label="平均每月超支"
            value={formatCurrency(summary.averageMonthlyOverspend)}
          />
          <MetricChip label="综合超支情况" value={netBudgetStatus} />
        </View>
      </LinearGradient>

      <CategoryRankingList
        title="本月分类消费排名"
        items={summary.selectedMonthRanking}
        emptyTitle="本月暂无分类数据"
        emptyBody="去“记账”页选择月份后录入第一笔支出。"
      />

      <View style={styles.overviewBillSection}>
        <SectionHeader title="本月账单" />
        {summary.selectedEntries.length > 0 ? (
          <View style={styles.entryList}>
            {summary.selectedEntries.map((entry) => (
              <Pressable key={entry.id} style={styles.entryRow} onPress={() => onDelete(entry)}>
                <View style={styles.entryLeft}>
                  <View
                    style={[
                      styles.entryAccent,
                      { backgroundColor: getCategoryDefinition(entry.category).color },
                    ]}
                  />
                  <View style={styles.entryTextGroup}>
                    <Text style={styles.entryTitle}>
                      {entry.category}
                      {entry.subcategory ? ` · ${entry.subcategory}` : ''}
                    </Text>
                    <Text style={styles.entryMeta}>
                      {formatMonthLabel(entry.monthKey)}
                      {entry.note ? ` · ${entry.note}` : ''}
                    </Text>
                  </View>
                </View>
                <Text style={styles.entryAmount}>{formatCurrency(entry.amount)}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.overviewBillEmpty}>
            <EmptyBlock title="这个月还没有账单记录" body="在记账页选择对应月份后保存。" />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function TrendsScreen({
  selectedMonth,
  onMonthChange,
  summary,
  rankingCategories,
  selectedRankingCategory,
  onSelectRankingCategory,
}: {
  selectedMonth: string;
  onMonthChange: (monthKey: string) => void;
  summary: LedgerSummary;
  rankingCategories: string[];
  selectedRankingCategory: string | null;
  onSelectRankingCategory: (category: string) => void;
}) {
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionEyebrow}>Trend Room</Text>
        <Text style={styles.pageTitle}>消费趋势</Text>
      </View>

      <View style={styles.section}>
        <MonthSwitcher monthKey={selectedMonth} onChange={onMonthChange} />
        <View style={styles.statsGrid}>
          <StatBlock label="当前月份支出" value={formatCurrency(summary.selectedTotal)} />
          <StatBlock label="月均支出" value={formatCurrency(summary.monthlyAverage)} />
          <StatBlock label="累计超支" value={formatCurrency(summary.totalOverspend)} />
          <StatBlock
            label="平均每月超支"
            value={formatCurrency(summary.averageMonthlyOverspend)}
          />
          <StatBlock label="超支月份数" value={`${summary.overspendMonthCount} 个`} />
          <StatBlock
            label="最高月份"
            value={
              summary.peakMonth
                ? `${formatShortMonthLabel(summary.peakMonth.monthKey)} ${formatCurrency(
                    summary.peakMonth.total
                  )}`
                : '暂无'
            }
          />
        </View>
      </View>

      <View style={styles.section}>
        <MonthlyLineChart
          data={summary.monthlyTrend}
          budgetLimit={MONTHLY_BUDGET_LIMIT}
          selectedMonth={selectedMonth}
          onChangeMonth={onMonthChange}
        />
      </View>

      <OverspendRankingList rows={summary.overspendRanking} />

      <BudgetMonthStatusList rows={summary.monthlyBudgetRows} />

      <CategoryMonthRankingCard
        selectedCategory={selectedRankingCategory}
        categories={rankingCategories}
        rankingMap={summary.categoryMonthRanking}
        onSelectCategory={onSelectRankingCategory}
      />
    </ScrollView>
  );
}

function LoadingScreen() {
  return (
    <View style={styles.loadingScreen}>
      <ActivityIndicator size="large" color="#C76439" />
      <Text style={styles.loadingTitle}>正在打开账本</Text>
      <Text style={styles.loadingBody}>初始化本地数据库并加载月度记录。</Text>
    </View>
  );
}

function LoadingOverlay() {
  return (
    <View style={styles.loadingOverlay}>
      <ActivityIndicator size="small" color="#C76439" />
      <Text style={styles.loadingOverlayText}>同步账本中...</Text>
    </View>
  );
}

function MonthSwitcher({
  monthKey,
  onChange,
  light = false,
}: {
  monthKey: string;
  onChange: (monthKey: string) => void;
  light?: boolean;
}) {
  return (
    <View style={[styles.monthSwitcher, light && styles.monthSwitcherLight]}>
      <Pressable onPress={() => onChange(shiftMonth(monthKey, -1))} style={styles.monthButton}>
        <Text style={[styles.monthButtonText, light && styles.monthButtonTextLight]}>‹</Text>
      </Pressable>

      <Text style={[styles.monthLabel, light && styles.monthLabelLight]}>{formatMonthLabel(monthKey)}</Text>

      <Pressable onPress={() => onChange(shiftMonth(monthKey, 1))} style={styles.monthButton}>
        <Text style={[styles.monthButtonText, light && styles.monthButtonTextLight]}>›</Text>
      </Pressable>
    </View>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricChip}>
      <Text style={styles.metricChipLabel}>{label}</Text>
      <Text style={styles.metricChipValue}>{value}</Text>
    </View>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function SectionHeader({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {body ? <Text style={styles.sectionBody}>{body}</Text> : null}
    </View>
  );
}

function EmptyBlock({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyBlock}>
      <Text style={styles.emptyBlockTitle}>{title}</Text>
      <Text style={styles.emptyBlockBody}>{body}</Text>
    </View>
  );
}

const TAB_ITEMS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'overview', label: '概览', icon: '◉' },
  { key: 'add', label: '记账', icon: '+' },
  { key: 'trends', label: '趋势', icon: '↗' },
];

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F6EFE7',
  },
  appShell: {
    flex: 1,
    backgroundColor: '#F6EFE7',
  },
  screenContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 140,
    gap: 18,
  },
  heroPanel: {
    borderRadius: 34,
    paddingHorizontal: 22,
    paddingVertical: 22,
    gap: 14,
    shadowColor: '#20130D',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  heroKicker: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: '#DDBB93',
  },
  heroTotal: {
    fontSize: 46,
    lineHeight: 52,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#FFF7EF',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricChip: {
    minWidth: '47%',
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 247, 239, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 247, 239, 0.12)',
    gap: 4,
  },
  metricChipLabel: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#E6D7C8',
  },
  metricChipValue: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#FFF7EF',
  },
  section: {
    gap: 14,
  },
  overviewBillSection: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E4D5C8',
    backgroundColor: '#FBF7F1',
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
  },
  overviewBillEmpty: {
    paddingTop: 6,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    color: '#A16A52',
  },
  pageTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  pageBody: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: '#7E6C61',
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: '#7E6C61',
  },
  entryList: {
    gap: 12,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    borderRadius: 24,
    backgroundColor: '#FBF7F1',
    borderWidth: 1,
    borderColor: '#E7D7C8',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  entryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  entryAccent: {
    width: 10,
    height: 42,
    borderRadius: 999,
  },
  entryTextGroup: {
    flex: 1,
    gap: 4,
  },
  entryTitle: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  entryMeta: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: '#7E6C61',
  },
  entryAmount: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  emptyBlock: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E7D7C8',
    backgroundColor: '#FBF7F1',
    paddingHorizontal: 18,
    paddingVertical: 22,
    gap: 6,
  },
  emptyBlockTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  emptyBlockBody: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: '#7E6C61',
  },
  monthSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
    backgroundColor: '#FBF7F1',
    borderWidth: 1,
    borderColor: '#E7D7C8',
  },
  monthSwitcherLight: {
    backgroundColor: 'rgba(255, 247, 239, 0.08)',
    borderColor: 'rgba(255, 247, 239, 0.12)',
  },
  monthButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthButtonText: {
    fontSize: 21,
    lineHeight: 24,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#231B16',
  },
  monthButtonTextLight: {
    color: '#FFF7EF',
  },
  monthLabel: {
    minWidth: 98,
    textAlign: 'center',
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  monthLabelLight: {
    color: '#FFF7EF',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statBlock: {
    minWidth: '47%',
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E7D7C8',
    backgroundColor: '#FBF7F1',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 6,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#7E6C61',
  },
  statValue: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: '#F6EFE7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  loadingTitle: {
    fontSize: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  loadingBody: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: '#7E6C61',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 18,
    right: 20,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: '#FBF7F1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E7D7C8',
  },
  loadingOverlayText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_500Medium',
    fontWeight: '600',
    color: '#5E4D43',
  },
  tabBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(246, 239, 231, 0.96)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: '#E2D2C2',
  },
  tabButton: {
    flex: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
  },
  tabButtonActive: {
    backgroundColor: '#231B16',
  },
  tabIcon: {
    fontSize: 18,
    color: '#8D7A6E',
  },
  tabIconActive: {
    color: '#FFF7EF',
  },
  tabLabel: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#8D7A6E',
  },
  tabLabelActive: {
    color: '#FFF7EF',
  },
  errorBanner: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 108,
    borderRadius: 18,
    backgroundColor: '#8E2F33',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#FFF2F2',
  },
});
