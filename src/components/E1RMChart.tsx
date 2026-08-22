import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableWithoutFeedback } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../context/ThemeContext';
import { E1RMPoint, EPLEY_REP_LIMIT, daysBetween } from '../lib/analytics';

interface Props {
  points: E1RMPoint[];
  /** Smoothed curve to overlay; omitted when another metric is shown. */
  ewma?: { date: string; value: number }[];
  /** Points before this index are ramp-up and drawn dimmed. */
  dimBefore?: number;
}

const CHART_H = 160;
const PAD_L   = 38;
const PAD_R   = 14;
const PAD_TOP = 16;
const PAD_BOT = 28;

const LINE_COLOR   = '#22C55E';
const WARN_COLOR   = '#F97316';
const SMOOTH_COLOR = '#3B82F6';

/**
 * Single e1RM line over time — one point per session, showing that session's
 * best set. Tapping a point reveals what the estimate was built from.
 */
export default function E1RMChart({ points, ewma, dimBefore = 0 }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);

  const screenW = Dimensions.get('window').width;
  const chartW  = screenW - 48;
  const innerW  = chartW - PAD_L - PAD_R;
  const innerH  = CHART_H - PAD_TOP - PAD_BOT;

  const scale = useMemo(() => {
    const values = [...points.map(p => p.e1rm), ...(ewma?.map(e => e.value) ?? [])];
    const rawMax = Math.max(...values, 1);
    const rawMin = Math.min(...values, rawMax);
    // Pad the range a little so the line never hugs the frame
    const span = rawMax - rawMin || rawMax * 0.1 || 1;
    const min = Math.max(0, rawMin - span * 0.15);
    const max = rawMax + span * 0.15;
    return { min, max, range: max - min || 1 };
  }, [points, ewma]);

  /**
   * Points are placed by real elapsed days, not by index — otherwise a
   * three-week break looks exactly like two consecutive days.
   */
  const timeAxis = useMemo(() => {
    if (points.length === 0) return { start: '', totalDays: 1 };
    const start = points[0].date;
    const totalDays = Math.max(daysBetween(start, points[points.length - 1].date), 1);
    return { start, totalDays };
  }, [points]);

  if (points.length === 0) {
    return (
      <View style={[styles.empty, { borderColor: colors.border }]}>
        <Text style={[styles.emptyTxt, { color: colors.muted }]}>{t('noData')}</Text>
      </View>
    );
  }

  const xForDate = (date: string) =>
    PAD_L + (daysBetween(timeAxis.start, date) / timeAxis.totalDays) * innerW;

  const toX = (i: number) => xForDate(points[i].date);

  const toY = (e1rm: number) =>
    PAD_TOP + innerH - ((e1rm - scale.min) / scale.range) * innerH;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate()}.${d.getMonth() + 1}`;
  };

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.e1rm).toFixed(1)}`)
    .join(' ');

  const yLabels = [
    { y: PAD_TOP + innerH,     val: scale.min },
    { y: PAD_TOP + innerH / 2, val: scale.min + scale.range / 2 },
    { y: PAD_TOP,              val: scale.max },
  ];

  const xLabelIdxs = [0, Math.floor((points.length - 1) / 2), points.length - 1]
    .filter((v, i, a) => a.indexOf(v) === i);

  const active = selected !== null ? points[selected] : null;
  const hasOverEstimated = points.some(p => p.overEstimated);

  return (
    <TouchableWithoutFeedback onPress={() => setSelected(null)}>
      <View>
        <Svg width={chartW} height={CHART_H}>
          {yLabels.map((l, i) => (
            <Line
              key={`g${i}`}
              x1={PAD_L} y1={l.y}
              x2={PAD_L + innerW} y2={l.y}
              stroke={colors.border} strokeWidth={1} strokeDasharray="4,4"
            />
          ))}

          {yLabels.map((l, i) => (
            <SvgText
              key={`y${i}`}
              x={PAD_L - 5} y={l.y + 4}
              fontSize={9} fill={colors.muted} textAnchor="end"
            >
              {Math.round(l.val)}
            </SvgText>
          ))}

          {xLabelIdxs.map(i => (
            <SvgText
              key={`x${i}`}
              x={toX(i)} y={CHART_H - 6}
              fontSize={9} fill={colors.muted} textAnchor="middle"
            >
              {formatDate(points[i].date)}
            </SvgText>
          ))}

          {points.length > 1 && (
            <Path
              d={linePath}
              stroke={LINE_COLOR}
              strokeWidth={ewma ? 1.5 : 2.5}
              strokeOpacity={ewma ? 0.35 : 1}
              fill="none"
              strokeLinecap="round" strokeLinejoin="round"
            />
          )}

          {/* Smoothed curve sits on top of the raw line when shown */}
          {ewma && ewma.length > 1 && (
            <Path
              d={ewma
                .map((e, i) => `${i === 0 ? 'M' : 'L'} ${xForDate(e.date).toFixed(1)} ${toY(e.value).toFixed(1)}`)
                .join(' ')}
              stroke={SMOOTH_COLOR} strokeWidth={3} fill="none"
              strokeLinecap="round" strokeLinejoin="round"
            />
          )}

          {points.map((p, i) => {
            const isActive = selected === i;
            const isRamp = i < dimBefore;
            const color = p.overEstimated ? WARN_COLOR : LINE_COLOR;
            return (
              <React.Fragment key={`${p.workoutId}-${i}`}>
                {/* Generous invisible hit area — the visible dot is too small to tap */}
                <Circle
                  cx={toX(i)} cy={toY(p.e1rm)} r={16}
                  fill="transparent"
                  onPress={() => setSelected(isActive ? null : i)}
                />
                <Circle
                  cx={toX(i)} cy={toY(p.e1rm)}
                  r={isActive ? 7 : 5}
                  fill={p.overEstimated ? colors.surface : color}
                  fillOpacity={isRamp ? 0.3 : 1}
                  stroke={color}
                  strokeOpacity={isRamp ? 0.45 : 1}
                  strokeWidth={p.overEstimated ? 2.5 : isActive ? 2.5 : 0}
                />
              </React.Fragment>
            );
          })}

          {/* Value above the newest point, unless a point is selected */}
          {selected === null && (
            <SvgText
              x={toX(points.length - 1)}
              y={toY(points[points.length - 1].e1rm) - 12}
              fontSize={11} fill={LINE_COLOR} textAnchor="middle" fontWeight="700"
            >
              {Math.round(points[points.length - 1].e1rm)}
            </SvgText>
          )}
        </Svg>

        {/* Tooltip */}
        {active && (
          <View style={[styles.tooltip, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <Text style={[styles.tooltipDate, { color: colors.muted }]}>
              {new Date(active.date).toLocaleDateString(undefined, {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            </Text>
            <Text style={[styles.tooltipMain, { color: colors.text }]}>
              {active.weight}kg × {active.reps}
            </Text>
            <Text style={[styles.tooltipE1RM, { color: LINE_COLOR }]}>
              e1RM {Math.round(active.e1rm)}kg
            </Text>
            {active.overEstimated && (
              <Text style={[styles.tooltipWarn, { color: WARN_COLOR }]}>
                ⚠ {t('e1rmOverestimated', { limit: EPLEY_REP_LIMIT })}
              </Text>
            )}
          </View>
        )}

        {!active && (
          <Text style={[styles.hint, { color: colors.muted }]}>
            {dimBefore > 0 ? `${t('trendRampNote')} · ` : ''}
            {hasOverEstimated ? `○ ${t('e1rmWeakPoint')} · ` : ''}
            {t('e1rmTapHint')}
          </Text>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  empty: {
    height: 60, borderWidth: 1, borderRadius: 8, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  emptyTxt: { fontSize: 12 },

  tooltip: {
    borderWidth: 1, borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 12,
    marginTop: 6, marginHorizontal: 4,
    gap: 1,
  },
  tooltipDate: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  tooltipMain: { fontSize: 15, fontWeight: '600' },
  tooltipE1RM: { fontSize: 13, fontWeight: '700' },
  tooltipWarn: { fontSize: 11, marginTop: 2 },

  hint: { fontSize: 10, marginTop: 6, paddingHorizontal: 4 },
});
