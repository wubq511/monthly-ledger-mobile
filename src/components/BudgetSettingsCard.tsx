import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getBudgetModeLabel } from '../lib/budgetInput';
import { formatMonthLabel } from '../lib/date';
import { formatCurrency } from '../lib/format';
import { MONTHLY_BUDGET_LIMIT } from '../lib/ledgerSummary';
import type { BudgetSettings } from '../types/ledger';

interface BudgetSettingsCardProps {
  monthKey: string;
  settings: BudgetSettings;
  loading: boolean;
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
  onEditDefaultBudget,
  onEditMonthBudget,
  onResetMonthBudget,
}: BudgetSettingsCardProps) {
  const mode = getBudgetModeLabel(monthKey, settings);
  const hasMonthOverride = mode === 'monthly';
  const defaultBudget = settings.defaultBudget;
  const effectiveBudget =
    settings.monthlyBudgets[monthKey] ?? settings.defaultBudget ?? MONTHLY_BUDGET_LIMIT;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>预算设置</Text>

      <View style={styles.infoList}>
        <InfoRow
          label="默认月预算"
          value={formatBudgetValue(defaultBudget)}
        />
        <InfoRow
          label={`${formatMonthLabel(monthKey)} 实际预算`}
          value={formatCurrency(effectiveBudget)}
          emphasized
        />
      </View>

      <View style={styles.actionGroup}>
        <View style={styles.actionRow}>
          <ActionButton
            label="修改默认预算"
            onPress={onEditDefaultBudget}
            disabled={loading}
            primary
            fill
          />
          <ActionButton
            label={hasMonthOverride ? '修改本月预算' : '设置本月预算'}
            onPress={onEditMonthBudget}
            disabled={loading}
            fill
          />
        </View>
        {hasMonthOverride ? (
          <View style={styles.actionRow}>
            <ActionButton
              label="恢复默认预算"
              onPress={onResetMonthBudget}
              disabled={loading}
              tone="danger"
              fill
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function InfoRow({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <View style={[styles.infoRow, emphasized && styles.infoRowEmphasized]}>
      <View style={styles.infoHeader}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  primary = false,
  tone = 'default',
  fill = false,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  primary?: boolean;
  tone?: 'default' | 'danger';
  fill?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        fill && styles.actionButtonFill,
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
  title: {
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
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
  actionGroup: {
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DECDBF',
    backgroundColor: '#FFFDFC',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonFill: {
    flex: 1,
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
