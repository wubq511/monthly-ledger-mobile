import { Suspense, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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

import { ExpenseForm } from './src/components/ExpenseForm';
import { MonthlyBarChart, MonthlyLineChart } from './src/components/Charts';
import { getCategoryDefinition } from './src/constants/categories';
import { formatMonthLabel, formatShortMonthLabel, getCurrentMonthKey, shiftMonth } from './src/lib/date';
import { formatCurrency } from './src/lib/format';
import { initializeDatabase } from './src/lib/database';
import { useLedgerData } from './src/hooks/useLedgerData';
import { buildLedgerSummary } from './src/lib/ledgerSummary';
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
  const { entries, loading, error, addEntry, removeEntry } = useLedgerData();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());

  const summary = buildLedgerSummary(entries, selectedMonth, formatShortMonthLabel);
  const topCategory = summary.categoryTotals[0];

  const handleAddExpense = async (draft: ExpenseDraft) => {
    await addEntry(draft);
    setSelectedMonth(draft.monthKey);
    setActiveTab('overview');
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
            selectedTotal={summary.selectedTotal}
            selectedCount={summary.selectedCount}
            monthlyAverage={summary.monthlyAverage}
            trackedMonthCount={summary.trackedMonthCount}
            topCategoryName={topCategory?.name ?? null}
            categoryTotals={summary.categoryTotals}
            recentEntries={summary.selectedEntries.slice(0, 8)}
            onDelete={handleDeleteExpense}
          />
        ) : null}

        {activeTab === 'add' ? (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ExpenseForm onSubmit={handleAddExpense} />
          </KeyboardAvoidingView>
        ) : null}

        {activeTab === 'trends' ? (
          <TrendsScreen
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            selectedTotal={summary.selectedTotal}
            monthlyAverage={summary.monthlyAverage}
            trackedMonthCount={summary.trackedMonthCount}
            monthlyTrend={summary.monthlyTrend}
            peakMonth={summary.peakMonth}
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
  selectedTotal,
  selectedCount,
  monthlyAverage,
  trackedMonthCount,
  topCategoryName,
  categoryTotals,
  recentEntries,
  onDelete,
}: {
  selectedMonth: string;
  onMonthChange: (monthKey: string) => void;
  selectedTotal: number;
  selectedCount: number;
  monthlyAverage: number;
  trackedMonthCount: number;
  topCategoryName: string | null;
  categoryTotals: Array<{ name: string; color: string; total: number }>;
  recentEntries: ExpenseEntry[];
  onDelete: (entry: ExpenseEntry) => void;
}) {
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={['#1E1A17', '#4B3125', '#7A4A37']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroPanel}>
        <Text style={styles.heroKicker}>Monthly Ledger</Text>
        <MonthSwitcher monthKey={selectedMonth} onChange={onMonthChange} light />
        <Text style={styles.heroTotal}>{formatCurrency(selectedTotal)}</Text>
        <Text style={styles.heroCaption}>
          {topCategoryName
            ? `本月支出最高的分类是 ${topCategoryName}`
            : '这是月份账本，所有汇总都会按月自动更新'}
        </Text>
        <View style={styles.metricRow}>
          <MetricChip label="本月记录数" value={`${selectedCount}`} />
          <MetricChip label="月均支出" value={formatCurrency(monthlyAverage)} />
        </View>
      </LinearGradient>

      <View style={styles.section}>
        <SectionHeader
          title="分类占比"
          body={`当前已记录 ${trackedMonthCount} 个月，这里展示 ${formatMonthLabel(selectedMonth)} 的分类分布。`}
        />
        {categoryTotals.length > 0 ? (
          <View style={styles.breakdownList}>
            {categoryTotals.map((item) => {
              const ratio = selectedTotal > 0 ? item.total / selectedTotal : 0;

              return (
                <View key={item.name} style={styles.breakdownRow}>
                  <View style={styles.breakdownHead}>
                    <View style={styles.breakdownTitleRow}>
                      <View style={[styles.dot, { backgroundColor: item.color }]} />
                      <Text style={styles.breakdownTitle}>{item.name}</Text>
                    </View>
                    <Text style={styles.breakdownValue}>{formatCurrency(item.total)}</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.max(ratio * 100, 8)}%`,
                          backgroundColor: item.color,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyBlock title="本月暂无分类数据" body="去“记账”页选择月份后录入第一笔支出。" />
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="本月记录" body="这里只显示月份，不显示具体日期。点击可删除错误账单。" />
        {recentEntries.length > 0 ? (
          <View style={styles.entryList}>
            {recentEntries.map((entry) => (
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
          <EmptyBlock title="这个月还没有账单记录" body="在记账页选择对应月份后保存。" />
        )}
      </View>
    </ScrollView>
  );
}

function TrendsScreen({
  selectedMonth,
  onMonthChange,
  selectedTotal,
  monthlyAverage,
  trackedMonthCount,
  monthlyTrend,
  peakMonth,
}: {
  selectedMonth: string;
  onMonthChange: (monthKey: string) => void;
  selectedTotal: number;
  monthlyAverage: number;
  trackedMonthCount: number;
  monthlyTrend: Array<{ key: string; label: string; value: number }>;
  peakMonth: { monthKey: string; total: number } | null;
}) {
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionEyebrow}>Trend Room</Text>
        <Text style={styles.pageTitle}>消费趋势</Text>
        <Text style={styles.pageBody}>趋势页只按月份看变化，不再显示具体到天的波动。</Text>
      </View>

      <View style={styles.section}>
        <MonthSwitcher monthKey={selectedMonth} onChange={onMonthChange} />
        <View style={styles.statsGrid}>
          <StatBlock label="当前月份支出" value={formatCurrency(selectedTotal)} />
          <StatBlock label="月均支出" value={formatCurrency(monthlyAverage)} />
          <StatBlock label="已记录月份" value={`${trackedMonthCount} 个`} />
          <StatBlock
            label="最高月份"
            value={
              peakMonth
                ? `${formatShortMonthLabel(peakMonth.monthKey)} ${formatCurrency(peakMonth.total)}`
                : '暂无'
            }
          />
        </View>
      </View>

      <View style={styles.section}>
        <MonthlyLineChart data={monthlyTrend} />
      </View>

      <View style={styles.section}>
        <MonthlyBarChart data={monthlyTrend} />
      </View>
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

function SectionHeader({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
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
    backgroundColor: '#F7F0E8',
  },
  appShell: {
    flex: 1,
    backgroundColor: '#F7F0E8',
  },
  screenContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 140,
    gap: 20,
  },
  heroPanel: {
    borderRadius: 32,
    paddingHorizontal: 22,
    paddingVertical: 22,
    gap: 14,
  },
  heroKicker: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: '#DDBB93',
  },
  heroTotal: {
    fontSize: 42,
    lineHeight: 48,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#FFF7EF',
  },
  heroCaption: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: '#E6D7C8',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricChip: {
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
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#FFF7EF',
  },
  section: {
    gap: 14,
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
  breakdownList: {
    gap: 14,
  },
  breakdownRow: {
    gap: 10,
  },
  breakdownHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  breakdownTitle: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_500Medium',
    fontWeight: '600',
    color: '#2A211C',
  },
  breakdownValue: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#5E4D43',
  },
  progressTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: '#E7D9CC',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
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
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: '#F7F0E8',
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
    backgroundColor: 'rgba(247, 240, 232, 0.96)',
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
