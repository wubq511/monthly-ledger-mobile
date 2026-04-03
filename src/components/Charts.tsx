import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import type { MonthlyTrendPoint } from '../lib/ledgerSummary';

const CHART_HEIGHT = 212;
const CHART_PADDING = 18;

interface MonthlyLineChartProps {
  data: MonthlyTrendPoint[];
  budgetLimit: number;
}

interface MonthlyBarChartProps {
  data: MonthlyTrendPoint[];
  budgetLimit: number;
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

export function MonthlyLineChart({ data, budgetLimit }: MonthlyLineChartProps) {
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

  return (
    <View style={styles.chartFrame} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartTitle}>近六个月支出曲线</Text>
          <Text style={styles.chartMeta}>橘线表示当月总支出，虚线表示 2000 元预算基准。</Text>
        </View>
        <Text style={styles.chartPeak}>峰值 {formatCompactCurrency(scaleMax)}</Text>
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

        <SvgText x={chartWidth - CHART_PADDING - 4} y={budgetY - 8} fill="#657C50" fontSize="11" textAnchor="end">
          预算 2000
        </SvgText>

        <Path d={areaPath} fill="url(#trendFill)" />
        <Path d={linePath} fill="none" stroke="url(#trendStroke)" strokeWidth={4} />

        {coordinates.map((point) => (
          <Circle
            key={point.key}
            cx={point.x}
            cy={point.y}
            r={4.5}
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
            fill="#7E6C61"
            fontSize="12"
            textAnchor="middle">
            {point.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

export function MonthlyBarChart({ data, budgetLimit }: MonthlyBarChartProps) {
  const [width, setWidth] = useState(0);
  const scaleMax = getChartScale(data, budgetLimit);
  const chartWidth = Math.max(width, 280);
  const innerWidth = chartWidth - CHART_PADDING * 2;
  const innerHeight = CHART_HEIGHT - CHART_PADDING * 2;
  const barGap = 10;
  const barWidth = Math.max(18, (innerWidth - barGap * (data.length - 1)) / data.length);

  if (scaleMax <= 0) {
    return <EmptyChart title="近月柱状图会在你开始跨月记账后出现" body="后续会和 2000 元预算线一起对照。" />;
  }

  const budgetY = CHART_PADDING + innerHeight - (budgetLimit / scaleMax) * innerHeight;

  return (
    <View style={styles.chartFrame} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartTitle}>近六个月总支出</Text>
          <Text style={styles.chartMeta}>绿色表示在预算内，橘红表示超出 2000 元上限。</Text>
        </View>
        <Text style={styles.chartPeak}>最高 {formatCompactCurrency(scaleMax)}</Text>
      </View>

      <Svg width="100%" height={CHART_HEIGHT}>
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

        {data.map((item, index) => {
          const height = scaleMax === 0 ? 0 : (item.value / scaleMax) * innerHeight;
          const x = CHART_PADDING + index * (barWidth + barGap);
          const y = CHART_PADDING + innerHeight - height;
          const fill =
            item.value > budgetLimit ? '#C66039' : index === data.length - 1 ? '#7C8B69' : '#9AAA88';

          return (
            <Rect
              key={item.key}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(height, 6)}
              rx={barWidth / 3}
              fill={fill}
            />
          );
        })}

        {data.map((item, index) => {
          const x = CHART_PADDING + index * (barWidth + barGap) + barWidth / 2;
          return (
            <SvgText
              key={`${item.key}-label`}
              x={x}
              y={CHART_HEIGHT - 4}
              fill="#7E6C61"
              fontSize="12"
              textAnchor="middle">
              {item.label}
            </SvgText>
          );
        })}
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
    gap: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  chartMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: '#7E6C61',
  },
  chartPeak: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#5E4D43',
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
