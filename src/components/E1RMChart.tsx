import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableWithoutFeedback } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../context/ThemeContext';
import { E1RMPoint, EPLEY_REP_LIMIT, daysBetween, TrendLine, CompareGroups } from '../lib/analytics';

/** What to draw on top of the raw points, so the shown metric is verifiable. */
export type ChartOverlay =
  | { kind: 'slope'; line: TrendLine | null }
  | { kind: 'blocks'; groups: CompareGroups | null }
  | { kind: 'ewma'; series: { date: string; value: number }[] };

/** One line per fatigue context, so comparable sessions stay visually together. */
export type ChartSeries = {
  label: string;
  points: E1RMPoint[];
  /** The context the most recent session belongs to. */
  current: boolean;
};

interface Props {
  points: E1RMPoint[];
  /** Draw a separate line per context instead of one line through everything. */
  series?: ChartSeries[];
  overlay?: ChartOverlay;
  /** Indices of the points feeding the current metric; the rest are dimmed. */
  usedIndices?: Set<number>;
}

const CHART_H = 160;
const PAD_L   = 38;
const PAD_R   = 14;
const PAD_TOP = 16;
const PAD_BOT = 28;

const LINE_COLOR   = '#22C55E';
const WARN_COLOR   = '#F97316';
const SMOOTH_COLOR = '#3B82F6';

/** Distinct on both themes; the current context always gets the first. */
const SERIES_COLORS = ['#22C55E', '#3B82F6', '#A855F7', '#F43F5E'];

/**
 * Single e1RM line over time — one point per session, showing that session's
 * best set. Tapping a point reveals what the estimate was built from.
 */
export default function E1RMChart({ points, series, overlay, usedIndices }: Props) {
  const ewma = overlay?.kind === 'ewma' ? overlay.series : undefined;
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

  // Which line a point belongs to, so its dot matches its series colour
  const seriesOf = new Map<number, number>();
  series?.forEach((serie, i) => serie.points.forEach(p => seriesOf.set(p.workoutId, i)));
  const colorFor = (p: E1RMPoint) =>
    p.overEstimated ? WARN_COLOR : SERIES_COLORS[seriesOf.get(p.workoutId) ?? 0];

  const active = selected !== null ? points[selected] : null;
  const hasOverEstimated = points.some(p => p.overEstimated);
  const hasDimmed = !series && usedIndices ? points.some((_, i) => !usedIndices.has(i)) : false;

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

          {!series && points.length > 1 && (
            <Path
              d={linePath}
              stroke={LINE_COLOR}
              strokeWidth={ewma ? 1.5 : 2.5}
              strokeOpacity={ewma ? 0.35 : 1}
              fill="none"
              strokeLinecap="round" strokeLinejoin="round"
            />
          )}

          {/* One line per context — the same exercise under different
              pre-fatigue is two different things and belongs on two lines */}
          {series?.map((serie, si) => serie.points.length > 1 && (
            <Path
              key={`s${si}`}
              d={serie.points
                .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xForDate(p.date).toFixed(1)} ${toY(p.e1rm).toFixed(1)}`)
                .join(' ')}
              stroke={SERIES_COLORS[si]}
              strokeWidth={serie.current ? 2.5 : 2}
              strokeOpacity={ewma ? 0.35 : serie.current ? 1 : 0.75}
              fill="none"
              strokeLinecap="round" strokeLinejoin="round"
            />
          ))}

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

          {/* Theil–Sen line — the slope the badge reports, drawn through the data */}
          {overlay?.kind === 'slope' && overlay.line && (
            <Line
              x1={xForDate(overlay.line.from.date)} y1={toY(overlay.line.from.value)}
              x2={xForDate(overlay.line.to.date)}   y2={toY(overlay.line.to.value)}
              stroke={SMOOTH_COLOR} strokeWidth={2.5} strokeDasharray="6,4" strokeLinecap="round"
            />
          )}

          {/* The two averaged groups — the vertical gap between them is the delta */}
          {overlay?.kind === 'blocks' && overlay.groups && (() => {
            const { previous, recent } = overlay.groups;
            const bar = (group: { points: E1RMPoint[]; avg: number }, color: string) => {
              const xs = group.points.map(p => xForDate(p.date));
              return { x1: Math.min(...xs), x2: Math.max(...xs), y: toY(group.avg), color };
            };
            const bars = [bar(previous, colors.muted), bar(recent, SMOOTH_COLOR)];
            return (
              <>
                {/* Connector showing the difference between both levels */}
                <Line
                  x1={bars[1].x2} y1={bars[0].y}
                  x2={bars[1].x2} y2={bars[1].y}
                  stroke={SMOOTH_COLOR} strokeWidth={1.5} strokeDasharray="3,3"
                />
                {bars.map((b, i) => (
                  <Line
                    key={`bar${i}`}
                    x1={b.x1 - 6} y1={b.y} x2={b.x2 + 6} y2={b.y}
                    stroke={b.color} strokeWidth={3} strokeLinecap="round"
                  />
                ))}
              </>
            );
          })()}

          {points.map((p, i) => {
            const isActive = selected === i;
            // With several lines the colours already say which is which;
            // dimming on top of that only makes the picture harder to read
            const isRamp = !series && usedIndices ? !usedIndices.has(i) : false;
            const color = colorFor(p);
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
          {selected === null && !series && (
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

        {series && series.length > 1 && (
          <View style={styles.legend}>
            {series.map((serie, si) => (
              <View key={`l${si}`} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: SERIES_COLORS[si] }]} />
                <Text style={[
                  styles.legendTxt,
                  { color: colors.muted },
                  serie.current && { color: SERIES_COLORS[si], fontWeight: '700' },
                ]}>
                  {serie.label} ({serie.points.length})
                </Text>
              </View>
            ))}
          </View>
        )}

        {!active && (
          <>
            {overlay && (
              <Text style={[styles.overlayHint, { color: SMOOTH_COLOR }]}>
                {overlay.kind === 'slope'  ? t('overlaySlope')
                 : overlay.kind === 'blocks' ? t('overlayBlocks')
                 : t('overlayEwma')}
              </Text>
            )}
            <Text style={[styles.hint, { color: colors.muted }]}>
              {hasDimmed ? `${t('overlayDimmed')} · ` : ''}
              {hasOverEstimated ? `○ ${t('e1rmWeakPoint')} · ` : ''}
              {t('e1rmTapHint')}
            </Text>
          </>
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

  overlayHint: { fontSize: 11, fontWeight: '600', marginTop: 6, paddingHorizontal: 4 },
  hint: { fontSize: 10, marginTop: 3, paddingHorizontal: 4 },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 4, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendTxt: { fontSize: 11 },
});
