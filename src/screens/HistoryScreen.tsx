import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Colors } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { getHistory, deleteWorkout, HistoryRow, getExercisePositions } from '../storage/database';
import { exerciseLabel } from '../lib/exerciseName';

type GroupedExercise = {
  exerciseName: string;
  sessions: { workoutId: number; date: string; sets: { reps: string; weight: string }[] }[];
};

export default function HistoryScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [grouped, setGrouped] = useState<GroupedExercise[]>([]);
  /** Position of each exercise in each workout, keyed workoutId|name. */
  const [positions, setPositions] = useState<Map<string, { position: number; total: number }>>(new Map());

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
        map[row.exerciseName] = { exerciseName: row.exerciseName, sessions: [] };
      }
      const ex = map[row.exerciseName];
      let session = ex.sessions.find(s => s.workoutId === row.workoutId);
      if (!session) {
        session = { workoutId: row.workoutId, date: row.date, sets: [] };
        ex.sessions.push(session);
      }
      session.sets.push({ reps: row.reps, weight: row.weight });
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
              <Text style={styles.exTitle}>{exerciseLabel(ex.exerciseName, t)}</Text>
              {ex.sessions.map(session => (
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
                    {session.sets.map((s, i) => (
                      <View key={i} style={styles.chip}>
                        <Text style={styles.chipText}>{s.reps} × {s.weight} kg</Text>
                      </View>
                    ))}
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
    exBlock: { marginBottom: 24 },
    exTitle: { fontFamily: 'BebasNeue_400Regular', fontSize: 20, letterSpacing: 1, color: c.accent, marginBottom: 8 },
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
  });
}
