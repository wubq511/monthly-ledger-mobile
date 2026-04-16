import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getBudgetModeLabel } from '../lib/budgetInput';
import { formatMonthLabel } from '../lib/date';
import { formatCurrency } from '../lib/format';
import { MONTHLY_BUDGET_LIMIT } from '../lib/ledgerSummary';
import type { BudgetSettings } from '../types/ledger';

interface BudgetSettingsCardProps {
  monthKey: string;
  settings: BudgetSettings;
  loading: boolean;
  error: string | null;
  statusText: string | null;
  onEditDefaultBudget: () => void;
  onEditMonthBudget: () => void;
  onResetMonthBudget: () => void;
}

function formatBudgetValue(amount: number | null) {
  return amount === null ? '未设置' : formatCurrency(amount);
}

export function BudgetSettingsCard({
  monthKey,
  settings,
  loading,
  error,
  statusText,
  onEditDefaultBudget,
  onEditMonthBudget,
  onResetMonthBudget,
}: BudgetSettingsCardProps) {
  const mode = getBudgetModeLabel(monthKey, settings);
  const hasMonthOverride = mode === 'monthly';
  const defaultBudget = settings.defaultBudget;
  const effectiveBudget =
    settings.monthlyBudgets[monthKey] ?? settings.defaultBudget ?? MONTHLY_BUDGET_LIMIT;
  const monthModeLabel = hasMonthOverride
    ? '本月单独预算'
    : defaultBudget !== null
      ? '跟随默认预算'
      : '跟随系统默认';
  const monthModeHint = hasMonthOverride
    ? `${formatMonthLabel(monthKey)} 会使用单独预算，不影响其他月份。`
    : defaultBudget !== null
      ? `${formatMonthLabel(monthKey)} 会跟随默认月预算。`
      : `还没设置默认预算，当前暂用系统默认 ${formatCurrency(MONTHLY_BUDGET_LIMIT)}。`;

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Budget Control</Text>
      <Text style={styles.title}>预算设置</Text>
      <Text style={styles.body}>支持默认月预算，也支持按当前录入月份设置单独预算。</Text>

      <View style={styles.infoList}>
        <InfoRow
          label="默认月预算"
          value={formatBudgetValue(defaultBudget)}
          body={
            defaultBudget === null
              ? `未设置时会回退到系统默认 ${formatCurrency(MONTHLY_BUDGET_LIMIT)}。`
              : '未单独设置的月份都会跟随这个预算。'
          }
        />
        <InfoRow
          label={`${formatMonthLabel(monthKey)} 实际预算`}
          value={formatCurrency(effectiveBudget)}
          body={`${monthModeLabel} · ${monthModeHint}`}
          emphasized
        />
      </View>

      {loading ? (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color="#9A5E3E" />
          <Text style={styles.statusText}>正在读取预算设置...</Text>
        </View>
      ) : null}

      {statusText ? <Text style={styles.statusText}>{statusText}</Text> : null}
      {error ? <Text style={styles.errorText}>预算设置读取失败：{error}</Text> : null}

      <View style={styles.actionGroup}>
        <ActionButton label="修改默认预算" onPress={onEditDefaultBudget} disabled={loading} primary />
        <ActionButton
          label={hasMonthOverride ? '修改本月预算' : '设置本月预算'}
          onPress={onEditMonthBudget}
          disabled={loading}
        />
        {hasMonthOverride ? (
          <ActionButton label="恢复默认预算" onPress={onResetMonthBudget} disabled={loading} tone="danger" />
        ) : null}
      </View>
    </View>
  );
}

function InfoRow({
  label,
  value,
  body,
  emphasized = false,
}: {
  label: string;
  value: string;
  body: string;
  emphasized?: boolean;
}) {
  return (
    <View style={[styles.infoRow, emphasized && styles.infoRowEmphasized]}>
      <View style={styles.infoHeader}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
      <Text style={styles.infoBody}>{body}</Text>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  primary = false,
  tone = 'default',
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  primary?: boolean;
  tone?: 'default' | 'danger';
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        primary && styles.actionButtonPrimary,
        tone === 'danger' && styles.actionButtonDanger,
        disabled && styles.actionButtonDisabled,
        pressed && !disabled && styles.actionButtonPressed,
      ]}>
      <Text
        style={[
          styles.actionButtonText,
          primary && styles.actionButtonTextPrimary,
          tone === 'danger' && styles.actionButtonTextDanger,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E4D5C8',
    backgroundColor: '#FBF7F1',
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
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
    fontSize: 20,
    lineHeight: 24,
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
  infoList: {
    gap: 10,
  },
  infoRow: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E7D7C8',
    backgroundColor: '#FFFDFC',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  infoRowEmphasized: {
    borderColor: '#D8C1B0',
    backgroundColor: '#FFF8F1',
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#5C4A3F',
  },
  infoValue: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  infoBody: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: '#806D62',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#9A5E3E',
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#8E2F33',
  },
  actionGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DECDBF',
    backgroundColor: '#FFFDFC',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionButtonPrimary: {
    borderColor: '#231B16',
    backgroundColor: '#231B16',
  },
  actionButtonDanger: {
    borderColor: '#E2C0BB',
    backgroundColor: '#FFF4F3',
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
  actionButtonPressed: {
    opacity: 0.86,
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#5C4A3F',
  },
  actionButtonTextPrimary: {
    color: '#FBF7F1',
  },
  actionButtonTextDanger: {
    color: '#A1464E',
  },
});
