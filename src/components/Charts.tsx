import { useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { formatCompactCurrency } from '../lib/format';
import { getBudgetLabelLayout } from '../lib/chartLayout';
import type { MonthlyTrendPoint } from '../lib/ledgerSummary';
import { getTrendMonthAfterSwipe } from '../lib/trendWindow';

const CHART_HEIGHT = 212;
const CHART_PADDING = 18;
const BUDGET_LABEL_WIDTH = 76;

interface MonthlyLineChartProps {
  data: MonthlyTrendPoint[];
  budgetLimit: number;
  selectedMonth: string;
  onChangeMonth: (monthKey: string) => void;
}

function EmptyChart({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyChart}>
      <Text style={styles.emptyChartTitle}>{title}</Text>
      <Text style={styles.emptyChartBody}>{body}</Text>
    </View>
  );
}

function getChartScale(data: MonthlyTrendPoint[], budgetLimit: number) {
  return Math.max(...data.map((item) => item.value), budgetLimit, 0);
}

export function MonthlyLineChart({
  data,
  budgetLimit,
  selectedMonth,
  onChangeMonth,
}: MonthlyLineChartProps) {
  const [width, setWidth] = useState(0);
  const scaleMax = getChartScale(data, budgetLimit);
  const chartWidth = Math.max(width, 280);
  const innerWidth = chartWidth - CHART_PADDING * 2;
  const innerHeight = CHART_HEIGHT - CHART_PADDING * 2;

  if (scaleMax <= 0) {
    return <EmptyChart title="记几个月后这里会形成趋势曲线" body="趋势线和预算基准会一起出现。" />;
  }

  const coordinates = data.map((item, index) => {
    const x =
      CHART_PADDING +
      (data.length === 1 ? innerWidth / 2 : (innerWidth * index) / (data.length - 1));
    const y = CHART_PADDING + innerHeight - (item.value / scaleMax) * innerHeight;
    return { ...item, x, y };
  });

  const budgetY = CHART_PADDING + innerHeight - (budgetLimit / scaleMax) * innerHeight;
  const linePath = coordinates
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1].x} ${
    CHART_PADDING + innerHeight
  } L ${coordinates[0].x} ${CHART_PADDING + innerHeight} Z`;

  const budgetLabelLayout = getBudgetLabelLayout(chartWidth, CHART_PADDING, BUDGET_LABEL_WIDTH);
  const budgetLabelY = Math.max(CHART_PADDING + 12, budgetY - 8);
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) =>
      Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
    onPanResponderRelease: (_, gestureState) => {
      const nextMonth = getTrendMonthAfterSwipe(selectedMonth, gestureState.dx);

      if (nextMonth !== selectedMonth) {
        onChangeMonth(nextMonth);
      }
    },
  });

  return (
    <View
      style={styles.chartFrame}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      {...panResponder.panHandlers}>
      <View style={styles.chartHeader}>
        <View style={styles.chartHeaderMain}>
          <Text style={styles.chartTitle} numberOfLines={1}>
            六个月支出曲线
          </Text>
        </View>
        <View style={styles.chartPeakStack}>
          <Text style={styles.chartPeakLabel} numberOfLines={1}>
            峰值
          </Text>
          <Text style={styles.chartPeakValue} numberOfLines={1}>
            {formatCompactCurrency(scaleMax)}
          </Text>
        </View>
      </View>

      <Svg width="100%" height={CHART_HEIGHT}>
        <Defs>
          <SvgLinearGradient id="trendFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#E28C5A" stopOpacity="0.32" />
            <Stop offset="100%" stopColor="#E28C5A" stopOpacity="0.04" />
          </SvgLinearGradient>
          <SvgLinearGradient id="trendStroke" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#F1B05A" />
            <Stop offset="100%" stopColor="#C04D45" />
          </SvgLinearGradient>
        </Defs>

        {[0, 1, 2, 3].map((step) => {
          const y = CHART_PADDING + (innerHeight / 3) * step;
          return (
            <Line
              key={step}
              x1={CHART_PADDING}
              y1={y}
              x2={chartWidth - CHART_PADDING}
              y2={y}
              stroke="#E1D3C4"
              strokeDasharray="4 6"
              strokeWidth={1}
            />
          );
        })}

        <Line
          x1={CHART_PADDING}
          y1={budgetY}
          x2={chartWidth - CHART_PADDING}
          y2={budgetY}
          stroke="#657C50"
          strokeDasharray="6 6"
          strokeWidth={2}
        />

        <Rect
          x={budgetLabelLayout.left}
          y={budgetLabelY - 12}
          width={BUDGET_LABEL_WIDTH}
          height={18}
          rx={9}
          fill="#FBF7F1"
          opacity={0.96}
        />
        <SvgText
          x={budgetLabelLayout.textX}
          y={budgetLabelY}
          fill="#657C50"
          fontSize="11"
          textAnchor="end">
          预算 2000
        </SvgText>

        <Path d={areaPath} fill="url(#trendFill)" />
        <Path d={linePath} fill="none" stroke="url(#trendStroke)" strokeWidth={4} />

        {coordinates.map((point) => (
          <Circle
            key={point.key}
            cx={point.x}
            cy={point.y}
            r={point.key === selectedMonth ? 5.5 : 4.5}
            fill="#F9F3EC"
            stroke={point.value > budgetLimit ? '#C04D45' : '#657C50'}
            strokeWidth={2}
          />
        ))}

        {coordinates.map((point) => (
          <SvgText
            key={`${point.key}-label`}
            x={point.x}
            y={CHART_HEIGHT - 4}
            fill={point.key === selectedMonth ? '#231B16' : '#7E6C61'}
            fontSize="12"
            textAnchor="middle">
            {point.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  chartFrame: {
    borderRadius: 28,
    backgroundColor: '#FBF7F1',
    padding: 16,
    borderWidth: 1,
    borderColor: '#E7D7C8',
    gap: 12,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  chartHeaderMain: {
    flex: 1,
    minWidth: 0,
  },
  chartTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  chartPeakStack: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    flexShrink: 1,
    minWidth: 0,
    maxWidth: 72,
  },
  chartPeakLabel: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#8A7567',
  },
  chartPeakValue: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#5E4D43',
    textAlign: 'right',
  },
  emptyChart: {
    borderRadius: 28,
    backgroundColor: '#FBF7F1',
    paddingVertical: 38,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E7D7C8',
    gap: 6,
  },
  emptyChartTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  emptyChartBody: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: '#7E6C61',
  },
});
