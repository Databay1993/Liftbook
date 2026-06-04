import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { ProgressByWeightRow } from '../storage/database';

interface Props {
  data: ProgressByWeightRow[];
}

const CHART_H  = 150;
const PAD_L    = 36;
const PAD_R    = 12;
const PAD_TOP  = 12;
const PAD_BOT  = 28;
const MAX_LINES = 5;

// Fixed colors that look good on both dark and light themes
const LINE_COLORS = ['#3B82F6', '#22C55E', '#F97316', '#A855F7', '#F43F5E'];

export default function ProgressChartByWeight({ data }: Props) {
  const { colors } = useTheme();
  const screenW = Dimensions.get('window').width;
  const chartW  = screenW - 48;
  const innerW  = chartW - PAD_L - PAD_R;
  const innerH  = CHART_H - PAD_TOP - PAD_BOT;

  // Group data by weight → take top MAX_LINES heaviest with ≥1 session
  const byWeight = useMemo(() => {
    const map: Record<number, { date: string; maxReps: number }[]> = {};
    for (const row of data) {
      if (!map[row.weight]) map[row.weight] = [];
      map[row.weight].push({ date: row.date, maxReps: row.maxReps });
    }
    return map;
  }, [data]);

  const weights = Object.keys(byWeight)
    .map(Number)
    .sort((a, b) => b - a)   // heaviest first
    .slice(0, MAX_LINES);

  // All unique dates sorted (shared X axis)
  const allDates = useMemo(() =>
    [...new Set(data.map(r => r.date))].sort(),
  [data]);

  const maxReps = Math.max(...data.map(r => r.maxReps), 1);
  const minReps = Math.max(0, Math.min(...data.map(r => r.maxReps)) - 1);
  const repsRange = maxReps - minReps || 1;

  function toX(date: string) {
    const i = allDates.indexOf(date);
    return PAD_L + (i / Math.max(allDates.length - 1, 1)) * innerW;
  }

  function toY(reps: number) {
    return PAD_TOP + innerH - ((reps - minReps) / repsRange) * innerH;
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate()}.${d.getMonth() + 1}`;
  };

  if (allDates.length < 2) {
    return (
      <View style={[styles.empty, { borderColor: colors.border }]}>
        <Text style={[styles.emptyTxt, { color: colors.muted }]}>
          Mindestens 2 Sessions nötig
        </Text>
      </View>
    );
  }

  // Y-axis labels
  const yLabels = [
    { y: PAD_TOP + innerH, val: minReps },
    { y: PAD_TOP + innerH / 2, val: Math.round(minReps + repsRange / 2) },
    { y: PAD_TOP, val: maxReps },
  ];

  // X-axis labels: first, middle, last
  const xLabelIdxs = [0, Math.floor((allDates.length - 1) / 2), allDates.length - 1]
    .filter((v, i, a) => a.indexOf(v) === i);

  return (
    <View>
      <Svg width={chartW} height={CHART_H}>
        {/* Grid lines */}
        {yLabels.map((l, i) => (
          <Line
            key={i}
            x1={PAD_L} y1={l.y}
            x2={PAD_L + innerW} y2={l.y}
            stroke={colors.border} strokeWidth={1} strokeDasharray="4,4"
          />
        ))}

        {/* Y labels */}
        {yLabels.map((l, i) => (
          <SvgText key={i} x={PAD_L - 4} y={l.y + 4}
            fontSize={9} fill={colors.muted} textAnchor="end">
            {Math.round(l.val)}
          </SvgText>
        ))}

        {/* X labels */}
        {xLabelIdxs.map(i => (
          <SvgText key={i}
            x={toX(allDates[i])} y={CHART_H - 6}
            fontSize={9} fill={colors.muted} textAnchor="middle">
            {formatDate(allDates[i])}
          </SvgText>
        ))}

        {/* One line per weight */}
        {weights.map((w, wi) => {
          const color = LINE_COLORS[wi];
          const pts = byWeight[w];
          if (pts.length === 0) return null;

          const linePath = pts
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.date).toFixed(1)} ${toY(p.maxReps).toFixed(1)}`)
            .join(' ');

          return (
            <React.Fragment key={w}>
              {pts.length > 1 && (
                <Path d={linePath} stroke={color} strokeWidth={2} fill="none"
                  strokeLinecap="round" strokeLinejoin="round" />
              )}
              {pts.map((p, i) => (
                <Circle key={i}
                  cx={toX(p.date)} cy={toY(p.maxReps)}
                  r={4.5} fill={color}
                />
              ))}
              {/* Reps label above last dot */}
              <SvgText
                x={toX(pts[pts.length - 1].date)}
                y={toY(pts[pts.length - 1].maxReps) - 8}
                fontSize={9} fill={color} textAnchor="middle" fontWeight="700">
                {pts[pts.length - 1].maxReps}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        {weights.map((w, wi) => (
          <View key={w} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: LINE_COLORS[wi] }]} />
            <Text style={[styles.legendTxt, { color: colors.muted }]}>{w} kg</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    height: 60, borderWidth: 1, borderRadius: 8, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  emptyTxt: { fontSize: 12 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 4, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendTxt: { fontSize: 11 },
});
