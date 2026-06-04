import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Colors } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { ProgressPoint } from '../storage/database';

interface Props {
  data: ProgressPoint[];
  metric: 'maxWeight' | 'maxReps' | 'totalVolume';
  unit: string;
}

const CHART_H = 130;
const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 28;

export default function ProgressChart({ data, metric, unit }: Props) {
  const { colors } = useTheme();
  const screenW = Dimensions.get('window').width;
  const chartW = screenW - 48; // account for outer padding
  const innerW = chartW - PAD_LEFT - PAD_RIGHT;
  const innerH = CHART_H - PAD_TOP - PAD_BOTTOM;

  // Take last 10 sessions
  const pts = data.slice(-10);

  const values = pts.map(p => p[metric]);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range  = maxVal - minVal || 1;

  // Map data to pixel coords
  const coords = pts.map((p, i) => ({
    x: PAD_LEFT + (i / Math.max(pts.length - 1, 1)) * innerW,
    y: PAD_TOP + innerH - ((p[metric] - minVal) / range) * innerH,
    value: p[metric],
    date: p.date,
  }));

  // Build SVG path
  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');

  // Fill area under line
  const fillPath = coords.length > 0
    ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(PAD_TOP + innerH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(PAD_TOP + innerH).toFixed(1)} Z`
    : '';

  // Y-axis labels (3 values)
  const yLabels = [
    { y: PAD_TOP + innerH, val: minVal },
    { y: PAD_TOP + innerH / 2, val: minVal + range / 2 },
    { y: PAD_TOP, val: maxVal },
  ];

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate()}.${d.getMonth() + 1}`;
  };

  const formatVal = (v: number) => {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return v % 1 === 0 ? String(Math.round(v)) : v.toFixed(1);
  };

  if (pts.length < 2) {
    return (
      <View style={[styles.empty, { borderColor: colors.border }]}>
        <Text style={[styles.emptyTxt, { color: colors.muted }]}>Mindestens 2 Sessions nötig</Text>
      </View>
    );
  }

  // Trend: last value vs first
  const trend = coords[coords.length - 1].value - coords[0].value;
  const trendColor = trend >= 0 ? '#22C55E' : '#EF4444';
  const trendSign  = trend >= 0 ? '+' : '';

  return (
    <View>
      <View style={styles.trendRow}>
        <Text style={[styles.trendTxt, { color: trendColor }]}>
          {trendSign}{formatVal(trend)} {unit}
        </Text>
        <Text style={[styles.sessionsTxt, { color: colors.muted }]}>
          {pts.length} Sessions
        </Text>
      </View>

      <Svg width={chartW} height={CHART_H}>
        <Defs>
          <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.accent} stopOpacity="0.25" />
            <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {yLabels.map((l, i) => (
          <Line
            key={i}
            x1={PAD_LEFT} y1={l.y}
            x2={PAD_LEFT + innerW} y2={l.y}
            stroke={colors.border}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        ))}

        {/* Fill */}
        {fillPath ? <Path d={fillPath} fill="url(#fill)" /> : null}

        {/* Line */}
        <Path d={linePath} stroke={colors.accent} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots */}
        {coords.map((c, i) => (
          <Circle key={i} cx={c.x} cy={c.y} r={4} fill={colors.accent} />
        ))}

        {/* Y labels */}
        {yLabels.map((l, i) => (
          <SvgText
            key={i}
            x={PAD_LEFT - 4} y={l.y + 4}
            fontSize={9} fill={colors.muted}
            textAnchor="end"
          >
            {formatVal(l.val)}
          </SvgText>
        ))}

        {/* X labels — show first, middle, last */}
        {[0, Math.floor((pts.length - 1) / 2), pts.length - 1]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map(i => (
            <SvgText
              key={i}
              x={coords[i].x} y={CHART_H - 6}
              fontSize={9} fill={colors.muted}
              textAnchor="middle"
            >
              {formatDate(pts[i].date)}
            </SvgText>
          ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    height: 60,
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTxt: { fontSize: 12 },
  trendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, paddingHorizontal: 4 },
  trendTxt: { fontSize: 13, fontWeight: '700' },
  sessionsTxt: { fontSize: 11 },
});
