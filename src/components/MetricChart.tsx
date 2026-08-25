import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableWithoutFeedback } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../context/ThemeContext';
import { MetricPoint, daysBetween } from '../lib/analytics';

interface Props {
  points: MetricPoint[];
  label: string;
  unit: string;
}

const CHART_H = 130;
const PAD_L   = 40;
const PAD_R   = 14;
const PAD_TOP = 14;
const PAD_BOT = 24;

const LINE_COLOR = '#F59E0B';

/**
 * A plain line over time for a user-defined measurement — peak power, an RPE,
 * a heart rate. Deliberately separate from the e1RM chart: these values are
 * not loads, so none of the trend machinery applies to them.
 */
export default function MetricChart({ points, label, unit }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);

  const screenW = Dimensions.get('window').width;
  const chartW  = screenW - 48;
  const innerW  = chartW - PAD_L - PAD_R;
  const innerH  = CHART_H - PAD_TOP - PAD_BOT;

  const scale = useMemo(() => {
    const values = points.map(p => p.value);
    const rawMax = Math.max(...values, 1);
    const rawMin = Math.min(...values, rawMax);
    const span = rawMax - rawMin || rawMax * 0.1 || 1;
    return {
      min: Math.max(0, rawMin - span * 0.15),
      max: rawMax + span * 0.15,
      get range() { return this.max - this.min || 1; },
    };
  }, [points]);

  const axis = useMemo(() => {
    if (points.length === 0) return { start: '', totalDays: 1 };
    const start = points[0].date;
    return {
      start,
      totalDays: Math.max(daysBetween(start, points[points.length - 1].date), 1),
    };
  }, [points]);

  if (points.length === 0) {
    return (
      <View style={[styles.empty, { borderColor: colors.border }]}>
        <Text style={[styles.emptyTxt, { color: colors.muted }]}>
          {t('metricNoData', { label })}
        </Text>
      </View>
    );
  }

  const toX = (date: string) =>
    PAD_L + (daysBetween(axis.start, date) / axis.totalDays) * innerW;
  const toY = (value: number) =>
    PAD_TOP + innerH - ((value - scale.min) / scale.range) * innerH;

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.date).toFixed(1)} ${toY(p.value).toFixed(1)}`)
    .join(' ');

  const yLabels = [
    { y: PAD_TOP + innerH, val: scale.min },
    { y: PAD_TOP,          val: scale.max },
  ];

  const active = selected !== null ? points[selected] : null;
  const latest = points[points.length - 1];
  const best = points.reduce((a, b) => (b.value > a.value ? b : a));

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate()}.${d.getMonth() + 1}`;
  };

  return (
    <TouchableWithoutFeedback onPress={() => setSelected(null)}>
      <View>
        <View style={styles.head}>
          <Text style={[styles.label, { color: colors.muted }]}>
            {label}{unit ? ` (${unit})` : ''}
          </Text>
          <Text style={[styles.latest, { color: LINE_COLOR }]}>
            {Math.round(latest.value)}{unit}
          </Text>
        </View>

        <Svg width={chartW} height={CHART_H}>
          {yLabels.map((l, i) => (
            <React.Fragment key={i}>
              <Line
                x1={PAD_L} y1={l.y} x2={PAD_L + innerW} y2={l.y}
                stroke={colors.border} strokeWidth={1} strokeDasharray="4,4"
              />
              <SvgText x={PAD_L - 5} y={l.y + 4} fontSize={9} fill={colors.muted} textAnchor="end">
                {Math.round(l.val)}
              </SvgText>
            </React.Fragment>
          ))}

          {points.length > 1 && (
            <Path d={path} stroke={LINE_COLOR} strokeWidth={2.5} fill="none"
              strokeLinecap="round" strokeLinejoin="round" />
          )}

          {points.map((p, i) => (
            <React.Fragment key={p.workoutId}>
              <Circle
                cx={toX(p.date)} cy={toY(p.value)} r={16} fill="transparent"
                onPress={() => setSelected(selected === i ? null : i)}
              />
              <Circle
                cx={toX(p.date)} cy={toY(p.value)}
                r={selected === i ? 6.5 : 4.5}
                fill={LINE_COLOR}
                stroke={LINE_COLOR}
                strokeWidth={selected === i ? 2.5 : 0}
              />
            </React.Fragment>
          ))}

          {[0, points.length - 1]
            .filter((v, i, a) => a.indexOf(v) === i)
            .map(i => (
              <SvgText
                key={`x${i}`}
                x={toX(points[i].date)} y={CHART_H - 5}
                fontSize={9} fill={colors.muted}
                textAnchor={i === 0 ? 'start' : 'end'}
              >
                {formatDate(points[i].date)}
              </SvgText>
            ))}
        </Svg>

        <Text style={[styles.foot, { color: colors.muted }]}>
          {active
            ? `${new Date(active.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} · ${Math.round(active.value)}${unit}`
            : t('metricBest', {
                value: Math.round(best.value),
                unit,
                date: new Date(best.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }),
              })}
        </Text>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  empty: {
    height: 54, borderWidth: 1, borderRadius: 8, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8, paddingHorizontal: 10,
  },
  emptyTxt: { fontSize: 11, textAlign: 'center' },
  head: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingHorizontal: 4, marginBottom: 2,
  },
  label: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  latest: { fontFamily: 'BebasNeue_400Regular', fontSize: 18 },
  foot: { fontSize: 10, paddingHorizontal: 4, marginTop: 2 },
});
