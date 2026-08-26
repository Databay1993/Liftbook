import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Colors } from '../theme';
import { useTheme } from '../context/ThemeContext';
import {
  getHistory, deleteWorkout, HistoryRow, getExercisePositions,
  ExtraField, SessionSet,
} from '../storage/database';
import { exerciseLabel } from '../lib/exerciseName';
import { formatSet } from '../lib/analytics';

type GroupedExercise = {
  exerciseName: string;
  trackingType: string;
  extraFields: ExtraField[];
  sessions: { workoutId: number; date: string; sets: SessionSet[] }[];
};

export default function HistoryScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [grouped, setGrouped] = useState<GroupedExercise[]>([]);
  /** Position of each exercise in each workout, keyed workoutId|name. */
  const [positions, setPositions] = useState<Map<string, { position: number; total: number }>>(new Map());
  /** Names whose sessions are unfolded — everything starts closed. */
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (name: string) => setOpen(prev => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  async function load() {
    const [rows, order] = await Promise.all([getHistory(), getExercisePositions()]);
    setGrouped(groupRows(rows));
    setPositions(new Map(
      order.map(o => [`${o.workoutId}|${o.exerciseName}`, { position: o.position, total: o.total }]),
    ));
  }

  function groupRows(rows: HistoryRow[]): GroupedExercise[] {
    const map: Record<string, GroupedExercise> = {};

    for (const row of rows) {
      if (!map[row.exerciseName]) {
        map[row.exerciseName] = {
          exerciseName: row.exerciseName,
          trackingType: row.trackingType,
          extraFields: row.extraFields,
          sessions: [],
        };
      }
      const ex = map[row.exerciseName];
      let session = ex.sessions.find(s => s.workoutId === row.workoutId);
      if (!session) {
        session = { workoutId: row.workoutId, date: row.date, sets: [] };
        ex.sessions.push(session);
      }
      session.sets.push({
        reps: row.reps, weight: row.weight, side: row.side, extras: row.extras,
      });
    }

    return Object.values(map);
  }

  async function handleDelete(workoutId: number) {
    Alert.alert(t('delete'), '', [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive', onPress: async () => {
          await deleteWorkout(workoutId);
          load();
        },
      },
    ]);
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.logo}>LIFTBOOK</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 90 }]}>
        <Text style={styles.pageTitle}>{t('history').toUpperCase()}</Text>

        {grouped.length === 0 ? (
          <Text style={styles.emptyState}>{t('noHistory')}</Text>
        ) : (
          grouped.map(ex => (
            <View key={ex.exerciseName} style={styles.exBlock}>
              <TouchableOpacity
                style={styles.exHead}
                onPress={() => toggle(ex.exerciseName)}
                activeOpacity={0.7}
              >
                <Text style={styles.exTitle}>{exerciseLabel(ex.exerciseName, t)}</Text>
                <Text style={styles.exCount}>
                  {t('sessionsCount' as any, { count: ex.sessions.length })}
                </Text>
                <Text style={styles.exChevron}>{open.has(ex.exerciseName) ? '▾' : '▸'}</Text>
              </TouchableOpacity>
              {open.has(ex.exerciseName) && ex.sessions.map(session => (
                <View key={session.workoutId} style={styles.sessionCard}>
                  <View style={styles.sessionHeader}>
                    <View style={styles.sessionMeta}>
                      {(() => {
                        const pos = positions.get(`${session.workoutId}|${ex.exerciseName}`);
                        if (!pos) return null;
                        return (
                          <View style={styles.posBadge}>
                            <Text style={styles.posBadgeTxt}>
                              {pos.position}. {t('ofTotal', { total: pos.total })}
                            </Text>
                          </View>
                        );
                      })()}
                      <Text style={styles.sessionDate}>{formatDate(session.date)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDelete(session.workoutId)}>
                      <Text style={styles.deleteBtn}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.chips}>
                    {session.sets.map((s, i) => {
                      const extras = ex.extraFields
                        .map(f => (s.extras?.[f.id] ? `${s.extras[f.id]}${f.unit}` : null))
                        .filter(Boolean);
                      return (
                        <View key={i} style={styles.chip}>
                          <Text style={styles.chipText}>
                            {formatSet(s, ex.trackingType)}
                            {extras.length > 0 && (
                              <Text style={styles.chipExtra}> · {extras.join(' · ')}</Text>
                            )}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
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
    pageTitle: { fontFamily: 'BebasNeue_400Regular', fontSize: 18, letterSpacing: 2, color: c.muted, marginBottom: 16 },
    emptyState: { textAlign: 'center', color: c.muted, paddingVertical: 40, fontSize: 14, lineHeight: 22 },
    exBlock: { marginBottom: 12 },
    exHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingVertical: 2 },
    exTitle: { fontFamily: 'BebasNeue_400Regular', fontSize: 20, letterSpacing: 1, color: c.accent, marginBottom: 8 },
    exCount: { flex: 1, fontSize: 11, color: c.muted },
    exChevron: { fontSize: 14, color: c.muted },
    sessionCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      padding: 13,
      marginBottom: 8,
    },
    sessionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    sessionMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    sessionDate: { fontSize: 11, color: c.muted },
    posBadge: {
      paddingHorizontal: 7, paddingVertical: 2,
      borderRadius: 10, borderWidth: 1,
      borderColor: c.accentBorder, backgroundColor: c.accentBg,
    },
    posBadgeTxt: { fontSize: 10, color: c.accent, fontWeight: '700' },
    deleteBtn: { fontSize: 16 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      backgroundColor: c.surface2,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      paddingHorizontal: 11,
      paddingVertical: 3,
    },
    chipText: { fontSize: 13, color: c.text },
    chipExtra: { fontSize: 11, color: c.muted },
  });
}
