import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Colors } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { SessionDetail } from '../storage/database';
import { summarizeSets, sessionVolume } from '../lib/analytics';
import { exerciseLabel } from '../lib/exerciseName';

interface Props {
  sessions: SessionDetail[];
}

/**
 * The two most recent training sessions with every exercise and its sets —
 * meant to answer "what did I do last time, and the time before that?".
 */
export default function RecentSessions({ sessions }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (sessions.length === 0) {
    return <Text style={styles.empty}>{t('noLastWorkout')}</Text>;
  }

  const dayLabel = (iso: string) => {
    const day = 86400000;
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diff = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / day);
    if (diff === 0) return t('today');
    if (diff === 1) return t('yesterday');
    return `${diff} ${t('daysAgo')}`;
  };

  const fullDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <View style={styles.wrap}>
      {sessions.map((session, idx) => (
        <View key={session.workoutId} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.badge}>
                {idx === 0 ? t('sessionLatest') : t('sessionPrevious')}
              </Text>
              <Text style={styles.date}>{fullDate(session.date)}</Text>
            </View>
            <Text style={styles.ago}>{dayLabel(session.date)}</Text>
          </View>

          {session.exercises.map(ex => {
            const vol = sessionVolume(ex.sets);
            return (
              <View key={ex.name} style={styles.exRow}>
                <View style={styles.exHeader}>
                  <Text style={styles.exName} numberOfLines={1}>{exerciseLabel(ex.name, t)}</Text>
                  <Text style={styles.exCount}>
                    {ex.sets.length} {t('sets')}
                    {vol > 0 ? ` · ${Math.round(vol)} kg` : ''}
                  </Text>
                </View>
                <Text style={styles.exSets}>{summarizeSets(ex.sets, ex.trackingType)}</Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    wrap: { gap: 10 },
    empty: { color: c.muted, fontSize: 13, paddingVertical: 8 },

    card: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      padding: 14,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 10,
      gap: 8,
    },
    badge: {
      fontSize: 10,
      color: c.accent,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 2,
    },
    date: { fontFamily: 'BebasNeue_400Regular', fontSize: 16, letterSpacing: 1, color: c.text },
    ago: { fontSize: 11, color: c.muted, paddingTop: 12 },

    exRow: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: 8,
      paddingBottom: 2,
      gap: 2,
    },
    exHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
    exName: { flex: 1, fontSize: 14, color: c.text, fontWeight: '600' },
    exCount: { fontSize: 11, color: c.muted },
    exSets: { fontSize: 13, color: c.accent, lineHeight: 19 },
  });
}
