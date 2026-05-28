import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { ExerciseProgressPoint } from '../storage/database';
import { Colors } from '../theme';

interface Props {
  data: ExerciseProgressPoint[];
  colors: Colors;
  width: number;
}

export default function ExerciseProgressChart({ data, colors, width }: Props) {
  if (data.length < 2) return null;

  const HEIGHT = 80;
  const PADDING = { top: 10, bottom: 20, left: 32, right: 8 };
  const chartW = width - PADDING.left - PADDING.right;
  const chartH = HEIGHT - PADDING.top - PADDING.bottom;

  const weights = data.map(d => d.maxWeight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;

  const toX = (i: number) => PADDING.left + (i / (data.length - 1)) * chartW;
  const toY = (w: number) => PADDING.top + chartH - ((w - minW) / range) * chartH;

  // Build SVG path
  const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(d.maxWeight).toFixed(1)}`).join(' ');

  // Determine if progress is positive (last > first)
  const improved = data[data.length - 1].maxWeight >= data[0].maxWeight;
  const lineColor = improved ? colors.accent : colors.danger;

  // Show only first, middle, last date labels
  const labelIndices = [0, Math.floor((data.length - 1) / 2), data.length - 1];

  return (
    <View style={{ marginTop: 6 }}>
      <Svg width={width} height={HEIGHT}>
        {/* Y axis labels */}
        <SvgText x={PADDING.left - 4} y={PADDING.top + 4} fontSize="9" fill={colors.muted} textAnchor="end">{maxW}kg</SvgText>
        <SvgText x={PADDING.left - 4} y={PADDING.top + chartH + 4} fontSize="9" fill={colors.muted} textAnchor="end">{minW}kg</SvgText>

        {/* Grid lines */}
        <Line x1={PADDING.left} y1={PADDING.top} x2={PADDING.left} y2={PADDING.top + chartH} stroke={colors.border} strokeWidth="1" />
        <Line x1={PADDING.left} y1={PADDING.top + chartH} x2={PADDING.left + chartW} y2={PADDING.top + chartH} stroke={colors.border} strokeWidth="1" />

        {/* Line path */}
        <Path d={pathD} stroke={lineColor} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {data.map((d, i) => (
          <Circle key={i} cx={toX(i)} cy={toY(d.maxWeight)} r="3" fill={lineColor} />
        ))}

        {/* X axis date labels */}
        {labelIndices.map(i => {
          const d = new Date(data[i].date);
          const label = `${d.getDate()}.${d.getMonth() + 1}`;
          return (
            <SvgText key={i} x={toX(i)} y={HEIGHT - 2} fontSize="9" fill={colors.muted} textAnchor="middle">{label}</SvgText>
          );
        })}
      </Svg>
    </View>
  );
}
