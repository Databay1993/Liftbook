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
  getExerciseSets,
} from '../storage/database';
import { buildE1RMSeries, summarizeTrend, E1RMPoint, TrendSummary } from '../lib/analytics';
import ProgressChartByWeight from '../components/ProgressChartByWeight';
import E1RMChart from '../components/E1RMChart';
import RecentSessions from '../components/RecentSessions';
import StatsLegend from '../components/StatsLegend';

type PR = { maxWeight: number; maxReps: number; bestVol: number; sessionCount: number };
type ExStats = { name: string; pr: PR; totalVol: number };
type ChartMode = 'e1rm' | 'byWeight';
type TrendMetric = 'slope' | 'blocks' | 'ewma';
const TREND_ORDER: TrendMetric[] = ['slope', 'blocks', 'ewma'];

type ExProgress = {
  name: string;
  points: ProgressByWeightRow[];
  e1rm: E1RMPoint[];
  trend: TrendSummary;
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

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  async function load() {
    const [rows, recent] = await Promise.all([getHistory(), getRecentWorkouts(2)]);
    setRecentSessions(recent);

    if (rows.length === 0) return;

    // Totals
    const workoutIds = new Set(rows.map(r => r.workoutId));
    const totalVol = rows.reduce((sum, r) => sum + (parseFloat(r.reps) * parseFloat(r.weight) || 0), 0);
    setTotals({ workouts: workoutIds.size, sets: rows.length, volume: Math.round(totalVol) });

    // Per-exercise stats
    const exMap: Record<string, { sessions: Set<number>; rows: HistoryRow[] }> = {};
    for (const row of rows) {
      if (!exMap[row.exerciseName]) exMap[row.exerciseName] = { sessions: new Set(), rows: [] };
      exMap[row.exerciseName].sessions.add(row.workoutId);
      exMap[row.exerciseName].rows.push(row);
    }

    const stats: ExStats[] = Object.entries(exMap).map(([name, data]) => {
      let maxWeight = 0, maxReps = 0, bestVol = 0, totalVol = 0;
      for (const r of data.rows) {
        const w = parseFloat(r.weight) || 0;
        const reps = parseFloat(r.reps) || 0;
        if (w > maxWeight) maxWeight = w;
        if (reps > maxReps) maxReps = reps;
        if (w * reps > bestVol) bestVol = w * reps;
        totalVol += w * reps;
      }
      return {
        name,
        pr: { maxWeight, maxReps, bestVol: Math.round(bestVol), sessionCount: data.sessions.size },
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
    const topExercises = stats.slice(0, 10).map(e => e.name);
    const progressData = await Promise.all(
      topExercises.map(async name => {
        const [points, sets] = await Promise.all([
          getExerciseProgressByWeight(name),
          getExerciseSets(name),
        ]);
        const e1rm = buildE1RMSeries(sets);
        return {
          name,
          points,
          e1rm,
          trend: summarizeTrend(e1rm),
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

  /** The badge next to the chart title: value, unit and what it means. */
  function describeTrend(trend: TrendSummary, metric: TrendMetric) {
    if (!trend.reliable) {
      return { value: t('trendTooFew'), label: t('trendLabelNone'), direction: 0 };
    }
    const fmt = (n: number) => `${n >= 0 ? '' : '−'}${Math.abs(n).toFixed(1)}`;

    switch (metric) {
      case 'slope': {
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

  const maxVol = Math.max(...exStats.map(e => e.totalVol), 1);

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
        <Text style={styles.sectionTitle}>{t('recentSessions').toUpperCase()}</Text>
        <RecentSessions sessions={recentSessions} />

        {/* ── Progress Charts ── */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{t('progressCharts').toUpperCase()}</Text>
        {progress.length === 0 ? (
          <Text style={styles.empty}>{t('noData')}</Text>
        ) : (
          progress.map(ex => (
            <View key={ex.name} style={styles.progressCard}>
              <TouchableOpacity style={styles.progressHeader} onPress={() => toggleExpand(ex.name)}>
                <Text style={styles.progressName}>{ex.name}</Text>
                <Text style={styles.progressArrow}>{ex.expanded ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {ex.expanded && (
                <View style={styles.chartWrap}>
                  {/* Mode toggle */}
                  <View style={styles.modeToggle}>
                    {([
                      { key: 'e1rm',     label: t('chartE1RM')     },
                      { key: 'byWeight', label: t('chartByWeight') },
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
                          <Text style={styles.chartLabel}>{t('chartE1RMHint')}</Text>
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
                        <E1RMChart
                          points={ex.e1rm}
                          ewma={ex.metric === 'ewma' ? ex.trend.ewma : undefined}
                          dimBefore={ex.trend.basisStart}
                        />
                      </>
                    ) : (
                      <>
                        <Text style={styles.chartLabel}>{t('chartByWeightHint')}</Text>
                        <ProgressChartByWeight data={ex.points} />
                      </>
                    )}
                  </View>
                </View>
              )}
            </View>
          ))
        )}

        {/* ── Personal Records ── */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{t('personalRecords').toUpperCase()}</Text>
        {exStats.length === 0 ? (
          <Text style={styles.empty}>{t('noData')}</Text>
        ) : (
          exStats.map(ex => (
            <View key={ex.name} style={styles.prCard}>
              <Text style={styles.prName}>
                {ex.name}{'  '}
                <Text style={styles.prSessions}>{ex.pr.sessionCount} {t('sessions')}</Text>
              </Text>
              <View style={styles.prChips}>
                <View style={styles.prChip}>
                  <Text style={styles.prChipVal}>{ex.pr.maxWeight}kg</Text>
                  <Text style={styles.prChipLabel}>{t('maxWeight')}</Text>
                </View>
                <View style={styles.prChip}>
                  <Text style={styles.prChipVal}>{ex.pr.maxReps}</Text>
                  <Text style={styles.prChipLabel}>{t('maxReps')}</Text>
                </View>
                <View style={styles.prChip}>
                  <Text style={styles.prChipVal}>{ex.pr.bestVol}</Text>
                  <Text style={styles.prChipLabel}>{t('bestVol')}</Text>
                </View>
              </View>
            </View>
          ))
        )}

        {/* ── Volume bars ── */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{t('totalVolume').toUpperCase()}</Text>
        {exStats.length === 0 ? (
          <Text style={styles.empty}>{t('noData')}</Text>
        ) : (
          exStats.map(ex => (
            <View key={ex.name} style={styles.volBar}>
              <View style={styles.volBarLabel}>
                <Text style={styles.volBarName}>{ex.name}</Text>
                <Text style={styles.volBarVal}>{ex.totalVol.toLocaleString()} kg</Text>
              </View>
              <View style={styles.volBarBg}>
                <View style={[styles.volBarFill, { width: `${Math.round(ex.totalVol / maxVol * 100)}%` }]} />
              </View>
            </View>
          ))
        )}

        {/* ── Weekly frequency ── */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{t('weeklyFrequency').toUpperCase()}</Text>
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
