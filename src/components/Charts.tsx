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

const CHART_HEIGHT = 196;
const CHART_PADDING = 18;

interface TrendDatum {
  key: string;
  label: string;
  value: number;
}

interface MonthlyLineChartProps {
  data: TrendDatum[];
}

interface MonthlyBarChartProps {
  data: TrendDatum[];
}

function EmptyChart({ title }: { title: string }) {
  return (
    <View style={styles.emptyChart}>
      <Text style={styles.emptyChartTitle}>{title}</Text>
      <Text style={styles.emptyChartBody}>当前没有可绘制的数据</Text>
    </View>
  );
}

export function MonthlyLineChart({ data }: MonthlyLineChartProps) {
  const [width, setWidth] = useState(0);
  const maxValue = Math.max(...data.map((item) => item.value), 0);
  const chartWidth = Math.max(width, 280);
  const innerWidth = chartWidth - CHART_PADDING * 2;
  const innerHeight = CHART_HEIGHT - CHART_PADDING * 2;

  if (maxValue <= 0) {
    return <EmptyChart title="记几个月后这里会形成趋势曲线" />;
  }

  const coordinates = data.map((item, index) => {
    const x =
      CHART_PADDING +
      (data.length === 1 ? innerWidth / 2 : (innerWidth * index) / (data.length - 1));
    const y = CHART_PADDING + innerHeight - (item.value / maxValue) * innerHeight;
    return { ...item, x, y };
  });

  const linePath = coordinates
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1].x} ${
    CHART_PADDING + innerHeight
  } L ${coordinates[0].x} ${CHART_PADDING + innerHeight} Z`;

  return (
    <View style={styles.chartFrame} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>近六个月趋势曲线</Text>
        <Text style={styles.chartMeta}>峰值 {formatCompactCurrency(maxValue)}</Text>
      </View>

      <Svg width="100%" height={CHART_HEIGHT}>
        <Defs>
          <SvgLinearGradient id="trendFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#C76439" stopOpacity="0.28" />
            <Stop offset="100%" stopColor="#C76439" stopOpacity="0.04" />
          </SvgLinearGradient>
          <SvgLinearGradient id="trendStroke" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#E19A5C" />
            <Stop offset="100%" stopColor="#B44A54" />
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

        <Path d={areaPath} fill="url(#trendFill)" />
        <Path d={linePath} fill="none" stroke="url(#trendStroke)" strokeWidth={4} />

        {coordinates.map((point) => (
          <Circle
            key={point.key}
            cx={point.x}
            cy={point.y}
            r={4.5}
            fill="#F9F3EC"
            stroke="#B44A54"
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

export function MonthlyBarChart({ data }: MonthlyBarChartProps) {
  const [width, setWidth] = useState(0);
  const maxValue = Math.max(...data.map((item) => item.value), 0);
  const chartWidth = Math.max(width, 280);
  const innerWidth = chartWidth - CHART_PADDING * 2;
  const innerHeight = CHART_HEIGHT - CHART_PADDING * 2;
  const barGap = 10;
  const barWidth = Math.max(18, (innerWidth - barGap * (data.length - 1)) / data.length);

  if (maxValue <= 0) {
    return <EmptyChart title="近月柱状图会在你开始跨月记账后出现" />;
  }

  return (
    <View style={styles.chartFrame} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>近六个月总支出</Text>
        <Text style={styles.chartMeta}>最高 {formatCompactCurrency(maxValue)}</Text>
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

        {data.map((item, index) => {
          const height = maxValue === 0 ? 0 : (item.value / maxValue) * innerHeight;
          const x = CHART_PADDING + index * (barWidth + barGap);
          const y = CHART_PADDING + innerHeight - height;

          return (
            <Rect
              key={item.key}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(height, 6)}
              rx={barWidth / 3}
              fill={index === data.length - 1 ? '#C76439' : '#7C8B69'}
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
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: '#231B16',
  },
  chartMeta: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: '#7E6C61',
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
    fontFamily: 'SpaceGrotesk_400Regular',
    color: '#7E6C61',
  },
});
