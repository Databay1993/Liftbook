import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Colors } from '../theme';
import { useTheme } from '../context/ThemeContext';
import {
  getHistory, HistoryRow,
  getRecentWorkouts, SessionDetail,
  getExerciseProgressByWeight, ProgressByWeightRow,
  getExerciseSets, getAllExercises, getWorkoutCompositions,
  getExerciseExtraValues, ExtraField,
} from '../storage/database';
import {
  buildE1RMSeries, summarizeTrend, analyzeContexts, positionSeries,
  buildMetricSeries, formatDuration,
  E1RMPoint, TrendSummary, ContextAnalysis, SetRule, PositionPoint, MetricPoint,
} from '../lib/analytics';
import ContextComparison from '../components/ContextComparison';
import { exerciseLabel } from '../lib/exerciseName';
import { loadSetRule } from '../lib/setRule';
import ProgressChartByWeight from '../components/ProgressChartByWeight';
import E1RMChart, { ChartOverlay, ChartSeries } from '../components/E1RMChart';
import RecentSessions from '../components/RecentSessions';
import StatsLegend from '../components/StatsLegend';
import MetricChart from '../components/MetricChart';

type PRChip = { value: string; labelKey: string };
type ExStats = { name: string; chips: PRChip[]; sessionCount: number; totalVol: number };

/**
 * Which records are worth showing depends on what the exercise measures.
 * A held plank has no heaviest set and a bodyweight pull-up has no kilos —
 * printing "0 kg" for those is noise, not a record.
 */
function prChipsFor(
  trackingType: string,
  pr: { maxWeight: number; maxReps: number; bestVol: number },
): PRChip[] {
  switch (trackingType) {
    case 'time':
      return [{ value: formatDuration(pr.maxReps), labelKey: 'maxDuration' }];
    case 'bodyweight':
      return [{ value: String(pr.maxReps), labelKey: 'maxReps' }];
    case 'percent':
      return [
        { value: `${pr.maxWeight}%`, labelKey: 'maxPercent' },
        { value: String(pr.maxReps), labelKey: 'maxReps' },
      ];
    case 'distance_time':
      return [
        { value: `${pr.maxWeight}km`, labelKey: 'maxDistance' },
        { value: formatDuration(pr.maxReps), labelKey: 'maxDuration' },
      ];
    default:
      return [
        { value: `${pr.maxWeight}kg`, labelKey: 'maxWeight' },
        { value: String(pr.maxReps), labelKey: 'maxReps' },
        { value: String(pr.bestVol), labelKey: 'bestVol' },
      ];
  }
}
type ChartMode = 'e1rm' | 'byWeight' | 'context' | 'extras';
type TrendMetric = 'slope' | 'blocks' | 'ewma';
const TREND_ORDER: TrendMetric[] = ['slope', 'blocks', 'ewma'];

/** The foldable top-level blocks of this screen, in the order they appear. */
type SectionKey = 'recent' | 'progress' | 'records' | 'volume' | 'frequency';

type ExProgress = {
  name: string;
  points: ProgressByWeightRow[];
  e1rm: E1RMPoint[];
  trend: TrendSummary;
  contexts: ContextAnalysis;
  /** Context the trend was restricted to, null when the whole history is used. */
  trendPreceding: string[] | null;
  /** True when sessions were left out because they are not comparable. */
  trendFiltered: boolean;
  muscleGroup: string | null;
  positions: PositionPoint[];
  /** User-defined measurements with their series, empty for most exercises. */
  extras: { field: ExtraField; points: MetricPoint[] }[];
  expanded: boolean;
  mode: ChartMode;
  metric: TrendMetric;
};

export default function StatsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [exStats, setExStats] = useState<ExStats[]>([]);
  const [totals, setTotals] = useState({ workouts: 0, sets: 0, volume: 0 });
  const [weekFreq, setWeekFreq] = useState<{ week: string; count: number }[]>([]);
  const [recentSessions, setRecentSessions] = useState<SessionDetail[]>([]);
  const [showLegend, setShowLegend] = useState(false);
  const [progress, setProgress] = useState<ExProgress[]>([]);

  // Every section starts folded, so the page opens as a table of contents
  // instead of a wall that has to be scrolled past to reach the next heading
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    recent: false, progress: false, records: false, volume: false, frequency: false,
  });
  const toggleSection = (key: SectionKey) => setOpen(o => ({ ...o, [key]: !o[key] }));

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  async function load() {
    const setRule = await loadSetRule();
    const [rows, recent, allExercises] = await Promise.all([
      getHistory(), getRecentWorkouts(2), getAllExercises(),
    ]);
    setRecentSessions(recent);

    if (rows.length === 0) return;

    // Volume only means something where the load is a weight. A percentage or
    // a distance multiplied by reps is not kilos and would inflate the total.
    const byWeight = new Set(
      allExercises.filter(e => e.trackingType === 'weight_reps').map(e => e.name),
    );
    const liftsWeight = (name: string) => byWeight.has(name);

    // Totals
    const workoutIds = new Set(rows.map(r => r.workoutId));
    const totalVol = rows.reduce(
      (sum, r) => sum + (liftsWeight(r.exerciseName) ? parseFloat(r.reps) * parseFloat(r.weight) || 0 : 0),
      0,
    );
    setTotals({ workouts: workoutIds.size, sets: rows.length, volume: Math.round(totalVol) });

    // Per-exercise stats
    const exMap: Record<string, { sessions: Set<number>; rows: HistoryRow[] }> = {};
    for (const row of rows) {
      if (!exMap[row.exerciseName]) exMap[row.exerciseName] = { sessions: new Set(), rows: [] };
      exMap[row.exerciseName].sessions.add(row.workoutId);
      exMap[row.exerciseName].rows.push(row);
    }

    const trackingOf = new Map(allExercises.map(e => [e.name, e.trackingType]));

    const stats: ExStats[] = Object.entries(exMap).map(([name, data]) => {
      let maxWeight = 0, maxReps = 0, bestVol = 0, totalVol = 0;
      const weighted = liftsWeight(name);
      for (const r of data.rows) {
        const w = parseFloat(r.weight) || 0;
        const reps = parseFloat(r.reps) || 0;
        if (w > maxWeight) maxWeight = w;
        if (reps > maxReps) maxReps = reps;
        if (weighted && w * reps > bestVol) bestVol = w * reps;
        if (weighted) totalVol += w * reps;
      }
      return {
        name,
        chips: prChipsFor(trackingOf.get(name) ?? 'weight_reps', {
          maxWeight, maxReps, bestVol: Math.round(bestVol),
        }),
        sessionCount: data.sessions.size,
        totalVol: Math.round(totalVol),
      };
    });
    setExStats(stats.sort((a, b) => b.totalVol - a.totalVol));

    // Weekly frequency (last 8 weeks)
    const weeks: Record<string, Set<number>> = {};
    for (const row of rows) {
      const d = new Date(row.date);
      const startOfYear = new Date(d.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
      const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      if (!weeks[key]) weeks[key] = new Set();
      weeks[key].add(row.workoutId);
    }
    const sorted = Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([key, ids]) => ({ week: key.split('-W')[1], count: ids.size }));
    setWeekFreq(sorted);

    // Progress data for each exercise (load all, expand on tap)
    const groupOf = new Map(allExercises.map(e => [e.name, e.muscleGroup]));

    // Ranked by how often it was trained, not by volume: a plank or a pull-up
    // has no kilos to sum, so a volume ranking pushed every one of them past
    // the cut-off and they never got a chart at all.
    const topExercises = [...stats]
      .sort((a, b) => b.sessionCount - a.sessionCount || b.totalVol - a.totalVol)
      .slice(0, 10)
      .map(e => e.name);
    const progressData = await Promise.all(
      topExercises.map(async name => {
        const info = allExercises.find(e => e.name === name);
        const [points, sets, compositions, extraRows] = await Promise.all([
          getExerciseProgressByWeight(name, setRule === 'first'),
          getExerciseSets(name),
          getWorkoutCompositions(name),
          (info?.extraFields.length ?? 0) > 0 ? getExerciseExtraValues(name) : Promise.resolve([]),
        ]);
        const e1rm = buildE1RMSeries(sets, setRule);
        const muscleGroup = groupOf.get(name) ?? null;
        const contexts = analyzeContexts(e1rm, compositions, name, muscleGroup);

        // The line should compare like with like, so the trend uses only the
        // sessions trained under the same pre-fatigue as the most recent one.
        // Without enough of those there is nothing to filter by, and the whole
        // history is the honest fallback.
        const currentGroup = contexts.groups.find(g => g.key === contexts.currentKey) ?? null;
        const filtered = !!currentGroup && currentGroup.points.length >= 2;
        const trendPoints = filtered ? currentGroup!.points : e1rm;

        return {
          name,
          points,
          e1rm,
          trend: summarizeTrend(trendPoints),
          contexts,
          trendPreceding: filtered ? currentGroup!.preceding : null,
          trendFiltered: filtered && currentGroup!.points.length < e1rm.length,
          muscleGroup,
          positions: positionSeries(compositions, name),
          extras: (info?.extraFields ?? []).map(field => ({
            field,
            points: buildMetricSeries(extraRows, field.id),
          })),
          expanded: false,
          mode: 'e1rm' as ChartMode,
          metric: 'slope' as TrendMetric,
        };
      })
    );
    setProgress(progressData);
  }

  function toggleExpand(name: string) {
    setProgress(prev => prev.map(p =>
      p.name === name ? { ...p, expanded: !p.expanded } : p
    ));
  }

  function setChartMode(name: string, mode: ChartMode) {
    setProgress(prev => prev.map(p => p.name === name ? { ...p, mode } : p));
  }

  function cycleMetric(name: string) {
    setProgress(prev => prev.map(p => {
      if (p.name !== name) return p;
      const next = TREND_ORDER[(TREND_ORDER.indexOf(p.metric) + 1) % TREND_ORDER.length];
      return { ...p, metric: next };
    }));
  }

  /**
   * What the chart draws for the selected metric, and which points feed it —
   * so the badge value can be checked against the picture instead of trusted.
   */
  function chartViewFor(ex: ExProgress): { overlay: ChartOverlay; used: Set<number> } {
    // The trend basis is no longer a contiguous tail of the series — filtering
    // by context can leave gaps — so points are matched by workout, not index
    const indicesOf = (points: { workoutId: number }[]) => new Set(
      points
        .map(p => ex.e1rm.findIndex(q => q.workoutId === p.workoutId))
        .filter(i => i >= 0)
    );

    switch (ex.metric) {
      case 'slope':
        return {
          overlay: { kind: 'slope', line: ex.trend.slopeLine },
          used: indicesOf(ex.trend.basis),
        };
      case 'blocks': {
        const groups = ex.trend.groups;
        return {
          overlay: { kind: 'blocks', groups },
          used: indicesOf(groups ? [...groups.previous.points, ...groups.recent.points] : ex.trend.basis),
        };
      }
      case 'ewma':
        return {
          overlay: { kind: 'ewma', series: ex.trend.ewma },
          used: indicesOf(ex.trend.basis),
        };
    }
  }

  /** At most this many lines; beyond that the chart becomes unreadable. */
  const MAX_SERIES = 4;

  /**
   * One line per fatigue context. Training the same order most of the time
   * means "after pull-ups" is the normal case rather than an exception, so
   * both belong on screen instead of one being dimmed away.
   */
  function seriesFor(ex: ExProgress): ChartSeries[] | undefined {
    const groups = ex.contexts.groups.filter(g => g.points.length > 0);
    if (groups.length < 2) return undefined;   // one line is the plain chart

    // Current context first so it gets the leading colour
    const ordered = [...groups].sort((a, b) => {
      if ((a.key === ex.contexts.currentKey) !== (b.key === ex.contexts.currentKey)) {
        return a.key === ex.contexts.currentKey ? -1 : 1;
      }
      return b.points.length - a.points.length;
    });

    return ordered.slice(0, MAX_SERIES).map(g => ({
      label: g.preceding.length === 0
        ? t('contextFresh')
        : `${t('contextAfter')} ${g.preceding.join(' + ')}`,
      points: g.points,
      current: g.key === ex.contexts.currentKey,
    }));
  }

  /** The badge next to the chart title: value, unit and what it means. */
  function describeTrend(trend: TrendSummary, metric: TrendMetric) {
    if (!trend.reliable) {
      return { value: t('trendTooFew'), label: t('trendLabelNone'), direction: 0 };
    }
    const fmt = (n: number) => `${n >= 0 ? '' : '−'}${Math.abs(n).toFixed(1)}`;

    switch (metric) {
      case 'slope': {
        // A week extrapolated to a month quadruples every wobble, so short
        // windows report what actually happened instead of a monthly rate
        if (trend.spanTooShort) {
          const c = trend.changeOverSpan;
          if (c === null) return { value: t('trendTooFew'), label: t('trendLabelNone'), direction: 0 };
          return {
            value: `${fmt(c)} kg`,
            label: t('trendLabelSpan', { days: trend.spanDays }),
            direction: Math.sign(c),
          };
        }
        const v = trend.slopePerMonth;
        if (v === null) return { value: t('trendTooFew'), label: t('trendLabelNone'), direction: 0 };
        return { value: `${fmt(v)} ${t('trendPerMonthUnit')}`, label: t('trendLabelSlope'), direction: Math.sign(v) };
      }
      case 'blocks': {
        const v = trend.blockDelta;
        if (v === null) return { value: t('trendTooFew'), label: t('trendLabelNone'), direction: 0 };
        return { value: `${fmt(v)} kg`, label: t('trendLabelBlocks'), direction: Math.sign(v) };
      }
      case 'ewma': {
        const v = trend.ewmaNow;
        if (v === null) return { value: t('trendTooFew'), label: t('trendLabelNone'), direction: 0 };
        return { value: `${Math.round(v)} kg`, label: t('trendLabelSmoothed'), direction: 0 };
      }
    }
  }

  // A time or bodyweight exercise has no kilos to sum, so it would sit here as
  // an empty bar reading "0 kg" — that is a missing unit, not a small number
  const volStats = exStats.filter(e => e.totalVol > 0);
  const maxVol = Math.max(...volStats.map(e => e.totalVol), 1);

  /** Foldable heading: title, how much is hidden behind it, and a chevron. */
  const head = (key: SectionKey, label: string, count: number, first = false) => (
    <TouchableOpacity
      style={[styles.sectionHead, !first && { marginTop: 24 }]}
      onPress={() => toggleSection(key)}
      activeOpacity={0.7}
    >
      <Text style={styles.sectionTitle}>{label.toUpperCase()}</Text>
      <Text style={styles.sectionCount}>{count}</Text>
      <Text style={styles.sectionChevron}>{open[key] ? '▾' : '▸'}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.logo}>LIFTBOOK</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 90 }]}>
        <View style={styles.pageTitleRow}>
          <Text style={styles.pageTitle}>{t('stats').toUpperCase()}</Text>
          <TouchableOpacity style={styles.legendBtn} onPress={() => setShowLegend(true)}>
            <Text style={styles.legendBtnTxt}>ℹ {t('legendButton')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Totals ── */}
        <View style={styles.statsRow}>
          {[
            { label: t('workouts'), value: totals.workouts },
            { label: t('sets'), value: totals.sets },
            { label: `${(totals.volume / 1000).toFixed(1)}t`, value: null, raw: t('volume') },
          ].map((s, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={styles.statNum}>{s.value ?? s.label}</Text>
              <Text style={styles.statLabel}>{s.value !== null ? s.label : s.raw}</Text>
            </View>
          ))}
        </View>

        {/* ── Recent sessions (last + previous) ── */}
        {head('recent', t('recentSessions'), recentSessions.length, true)}
        {open.recent && <RecentSessions sessions={recentSessions} />}

        {/* ── Progress Charts ── */}
        {head('progress', t('progressCharts'), progress.length)}
        {open.progress && (progress.length === 0 ? (
          <Text style={styles.empty}>{t('noData')}</Text>
        ) : (
          progress.map(ex => (
            <View key={ex.name} style={styles.progressCard}>
              <TouchableOpacity style={styles.progressHeader} onPress={() => toggleExpand(ex.name)}>
                <Text style={styles.progressName}>{exerciseLabel(ex.name, t)}</Text>
                <Text style={styles.progressArrow}>{ex.expanded ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {ex.expanded && (
                <View style={styles.chartWrap}>
                  {/* Mode toggle */}
                  <View style={styles.modeToggle}>
                    {([
                      { key: 'e1rm',     label: t('chartE1RM')     },
                      { key: 'byWeight', label: t('chartByWeight') },
                      { key: 'context',  label: t('chartContext')  },
                      ...(ex.extras.length > 0
                        ? [{ key: 'extras' as ChartMode, label: t('chartExtras') }]
                        : []),
                    ] as { key: ChartMode; label: string }[]).map(m => (
                      <TouchableOpacity
                        key={m.key}
                        style={[styles.modeBtn, ex.mode === m.key && styles.modeBtnActive]}
                        onPress={() => setChartMode(ex.name, m.key)}
                      >
                        <Text style={[styles.modeBtnTxt, ex.mode === m.key && styles.modeBtnTxtActive]}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.chartSection}>
                    {ex.mode === 'e1rm' ? (
                      <>
                        <View style={styles.chartHeadRow}>
                          <Text style={styles.chartLabel}>
                            {t('chartE1RMHint')}
                            {ex.trendPreceding !== null && (
                              <Text style={styles.chartScope}>
                                {'\n'}
                                {ex.trendPreceding.length === 0
                                  ? t('scopeFresh')
                                  : t('scopeAfter', { list: ex.trendPreceding.join(' + ') })}
                              </Text>
                            )}
                          </Text>
                          {(() => {
                            const d = describeTrend(ex.trend, ex.metric);
                            const color = d.direction > 0 ? colors.accent
                                        : d.direction < 0 ? colors.danger
                                        : colors.muted;
                            return (
                              <TouchableOpacity style={styles.trendBadge} onPress={() => cycleMetric(ex.name)}>
                                <Text style={[styles.trend, { color }]}>
                                  {d.direction > 0 ? '▲ ' : d.direction < 0 ? '▼ ' : ''}{d.value}
                                </Text>
                                <Text style={styles.trendLabel}>{d.label}</Text>
                              </TouchableOpacity>
                            );
                          })()}
                        </View>
                        {(() => {
                          const view = chartViewFor(ex);
                          return (
                            <E1RMChart
                              points={ex.e1rm}
                              series={seriesFor(ex)}
                              overlay={ex.trend.reliable ? view.overlay : undefined}
                              usedIndices={ex.trend.reliable ? view.used : undefined}
                            />
                          );
                        })()}
                      </>
                    ) : ex.mode === 'byWeight' ? (
                      <>
                        <Text style={styles.chartLabel}>{t('chartByWeightHint')}</Text>
                        <ProgressChartByWeight data={ex.points} />
                      </>
                    ) : ex.mode === 'extras' ? (
                      <View style={{ gap: 14 }}>
                        <Text style={styles.chartLabel}>{t('chartExtrasHint')}</Text>
                        {ex.extras.map(({ field, points }: { field: ExtraField; points: MetricPoint[] }) => (
                          <MetricChart
                            key={field.id}
                            points={points}
                            label={field.label}
                            unit={field.unit}
                          />
                        ))}
                      </View>
                    ) : (
                      <>
                        <Text style={styles.chartLabel}>{t('chartContextHint')}</Text>
                        <ContextComparison
                          analysis={ex.contexts}
                          muscleGroup={ex.muscleGroup}
                          positions={ex.positions}
                        />
                      </>
                    )}
                  </View>
                </View>
              )}
            </View>
          ))
        ))}

        {/* ── Personal Records ── */}
        {head('records', t('personalRecords'), exStats.length)}
        {open.records && (exStats.length === 0 ? (
          <Text style={styles.empty}>{t('noData')}</Text>
        ) : (
          exStats.map(ex => (
            <View key={ex.name} style={styles.prCard}>
              <Text style={styles.prName}>
                {exerciseLabel(ex.name, t)}{'  '}
                <Text style={styles.prSessions}>{ex.sessionCount} {t('sessions')}</Text>
              </Text>
              <View style={styles.prChips}>
                {ex.chips.map(chip => (
                  <View key={chip.labelKey} style={styles.prChip}>
                    <Text style={styles.prChipVal}>{chip.value}</Text>
                    <Text style={styles.prChipLabel}>{t(chip.labelKey as any)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        ))}

        {/* ── Volume bars ── */}
        {head('volume', t('totalVolume'), volStats.length)}
        {open.volume && (volStats.length === 0 ? (
          <Text style={styles.empty}>{t('noData')}</Text>
        ) : (
          volStats.map(ex => (
            <View key={ex.name} style={styles.volBar}>
              <View style={styles.volBarLabel}>
                <Text style={styles.volBarName}>{exerciseLabel(ex.name, t)}</Text>
                <Text style={styles.volBarVal}>{ex.totalVol.toLocaleString()} kg</Text>
              </View>
              <View style={styles.volBarBg}>
                <View style={[styles.volBarFill, { width: `${Math.round(ex.totalVol / maxVol * 100)}%` }]} />
              </View>
            </View>
          ))
        ))}

        {/* ── Weekly frequency ── */}
        {head('frequency', t('weeklyFrequency'), weekFreq.length)}
        {open.frequency && (
          <View style={styles.freqRow}>
            {weekFreq.length === 0 ? (
              <Text style={styles.empty}>{t('noData')}</Text>
            ) : (
              weekFreq.map(w => (
                <View key={w.week} style={[styles.freqChip, w.count >= 3 && styles.freqChipActive]}>
                  <Text style={[styles.freqText, w.count >= 3 && styles.freqTextActive]}>W{w.week}</Text>
                  <Text style={[styles.freqCount, w.count >= 3 && styles.freqTextActive]}>{w.count}×</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <StatsLegend visible={showLegend} onClose={() => setShowLegend(false)} />
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    logo: { fontFamily: 'BebasNeue_400Regular', fontSize: 26, letterSpacing: 3, color: c.accent },
    scroll: { flex: 1 },
    content: { padding: 16 },
    pageTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
      gap: 8,
    },
    pageTitle: { fontFamily: 'BebasNeue_400Regular', fontSize: 18, letterSpacing: 2, color: c.muted },
    legendBtn: {
      paddingHorizontal: 12, paddingVertical: 5,
      borderRadius: 14,
      borderWidth: 1, borderColor: c.border,
      backgroundColor: c.surface2,
    },
    legendBtnTxt: { fontSize: 11, color: c.muted },
    sectionTitle: { fontFamily: 'BebasNeue_400Regular', fontSize: 18, letterSpacing: 2, color: c.muted, marginBottom: 10 },
    sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    sectionCount: { flex: 1, fontSize: 12, color: c.muted, opacity: 0.6 },
    sectionChevron: { fontSize: 14, color: c.muted },
    empty: { color: c.muted, fontSize: 13, paddingVertical: 8 },

    // Totals
    statsRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
    statCard: {
      flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: 8, padding: 14, alignItems: 'center',
    },
    statNum: { fontFamily: 'BebasNeue_400Regular', fontSize: 30, color: c.accent },
    statLabel: { fontSize: 10, color: c.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },

    // Progress Charts
    progressCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      marginBottom: 8,
      overflow: 'hidden',
    },
    progressHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
    },
    progressName: { fontWeight: '600', fontSize: 14, color: c.text, flex: 1 },
    progressArrow: { color: c.muted, fontSize: 12 },
    chartWrap: { paddingHorizontal: 8, paddingBottom: 12, borderTopWidth: 1, borderTopColor: c.border },
    chartSection: { marginTop: 10 },
    chartHeadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: 4,
    },
    chartLabel: {
      flex: 1,
      fontSize: 11, color: c.muted,
      textTransform: 'uppercase', letterSpacing: 1,
      marginBottom: 4, paddingHorizontal: 4,
    },
    chartScope: { fontSize: 10, color: c.accent, textTransform: 'none', letterSpacing: 0 },
    trendBadge: { alignItems: 'flex-end', paddingLeft: 6, paddingBottom: 4, minWidth: 92 },
    trend: { fontFamily: 'BebasNeue_400Regular', fontSize: 17, letterSpacing: 0.5 },
    trendLabel: { fontSize: 9, color: c.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: -2 },

    // Chart mode toggle
    modeToggle: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 12,
      paddingHorizontal: 4,
    },
    modeBtn: {
      paddingHorizontal: 12, paddingVertical: 5,
      borderRadius: 14,
      borderWidth: 1, borderColor: c.border,
      backgroundColor: c.surface2,
    },
    modeBtnActive: { borderColor: c.accent, backgroundColor: c.accentBg },
    modeBtnTxt: { fontSize: 11, color: c.muted },
    modeBtnTxtActive: { color: c.accent, fontWeight: '700' },

    // PRs
    prCard: {
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: 10, padding: 14, marginBottom: 10,
    },
    prName: { fontWeight: '600', fontSize: 15, color: c.text, marginBottom: 8 },
    prSessions: { fontWeight: '400', fontSize: 12, color: c.muted },
    prChips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    prChip: {
      backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border,
      borderRadius: 6, padding: 8, paddingHorizontal: 12, alignItems: 'center',
    },
    prChipVal: { fontFamily: 'BebasNeue_400Regular', fontSize: 20, color: c.accent },
    prChipLabel: { color: c.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },

    // Volume bars
    volBar: { marginBottom: 14 },
    volBarLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    volBarName: { fontSize: 12, color: c.text },
    volBarVal: { fontFamily: 'BebasNeue_400Regular', fontSize: 15, color: c.accent },
    volBarBg: { backgroundColor: c.surface2, borderRadius: 4, height: 8, overflow: 'hidden' },
    volBarFill: { height: '100%', backgroundColor: c.accent, borderRadius: 4 },

    // Weekly freq
    freqRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 8 },
    freqChip: {
      backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border,
      borderRadius: 6, padding: 6, paddingHorizontal: 10, alignItems: 'center',
    },
    freqChipActive: { borderColor: c.accent, backgroundColor: c.accentBg },
    freqText: { fontSize: 11, color: c.muted },
    freqTextActive: { color: c.accent },
    freqCount: { fontSize: 13, fontWeight: '700', color: c.muted },
  });
}
