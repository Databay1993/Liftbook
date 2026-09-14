import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Colors } from '../theme';
import { useTheme } from '../context/ThemeContext';
import {
  getHistory, deleteWorkout, updateSet, deleteSet, HistoryRow,
  getExercisePositions, ExtraField, SessionSet,
} from '../storage/database';
import { exerciseLabel } from '../lib/exerciseName';
import { formatSetWithExtras } from '../lib/analytics';

/** A logged set plus the id needed to write a correction back to it. */
type EditableSet = SessionSet & { setId: number };

type GroupedExercise = {
  exerciseName: string;
  trackingType: string;
  extraFields: ExtraField[];
  sessions: { workoutId: number; date: string; sets: EditableSet[] }[];
};

/** The set currently open in the edit sheet, with its draft values. */
type Editing = {
  setId: number;
  exerciseName: string;
  trackingType: string;
  extraFields: ExtraField[];
  reps: string;
  weight: string;
  extras: Record<string, string>;
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

  const [editing, setEditing] = useState<Editing | null>(null);

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
        setId: row.setId,
        reps: row.reps, weight: row.weight, side: row.side, extras: row.extras,
      });
    }

    return Object.values(map);
  }

  function openEdit(ex: GroupedExercise, set: EditableSet) {
    setEditing({
      setId: set.setId,
      exerciseName: ex.exerciseName,
      trackingType: ex.trackingType,
      extraFields: ex.extraFields,
      reps: set.reps,
      weight: set.weight,
      extras: { ...set.extras },
    });
  }

  async function saveEdit() {
    if (!editing) return;
    await updateSet(editing.setId, {
      reps: editing.reps.trim(),
      weight: editing.weight.trim(),
      extras: editing.extras,
    });
    setEditing(null);
    load();
  }

  function confirmDeleteSet() {
    if (!editing) return;
    const setId = editing.setId;
    Alert.alert(t('deleteSetTitle'), t('deleteSetBody'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive', onPress: async () => {
          await deleteSet(setId);
          setEditing(null);
          load();
        },
      },
    ]);
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
        {grouped.length > 0 && <Text style={styles.pageHint}>{t('editSetHint')}</Text>}

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
                    {session.sets.map(s => (
                      <TouchableOpacity
                        key={s.setId}
                        style={styles.chip}
                        onPress={() => openEdit(ex, s)}
                        activeOpacity={0.6}
                      >
                        <Text style={styles.chipText}>
                          {formatSetWithExtras(s, ex.trackingType, ex.extraFields)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* Correcting a logged set */}
      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('editSetTitle')}</Text>
            <Text style={styles.sheetSub}>
              {editing && exerciseLabel(editing.exerciseName, t)}
            </Text>

            {editing && (
              <>
                {/* The load axis, whatever its unit — absent where there is none */}
                {editing.trackingType !== 'bodyweight' && editing.trackingType !== 'time' && (
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>
                      {editing.trackingType === 'percent' ? t('percent')
                        : editing.trackingType === 'distance_time' ? t('distanceKm')
                        : t('kg')}
                    </Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="decimal-pad"
                      value={editing.weight}
                      onChangeText={v => setEditing(e => e && { ...e, weight: v })}
                    />
                  </View>
                )}

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>
                    {editing.trackingType === 'time' || editing.trackingType === 'distance_time'
                      ? t('durationSec')
                      : t('reps')}
                  </Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={editing.reps}
                    onChangeText={v => setEditing(e => e && { ...e, reps: v })}
                  />
                </View>

                {editing.extraFields.map(f => (
                  <View key={f.id} style={styles.field}>
                    <Text style={styles.fieldLabel}>
                      {f.label}{f.unit ? ` (${f.unit})` : ''}
                    </Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="decimal-pad"
                      value={editing.extras[f.id] ?? ''}
                      onChangeText={v => setEditing(e => e && {
                        ...e, extras: { ...e.extras, [f.id]: v },
                      })}
                    />
                  </View>
                ))}
              </>
            )}

            <View style={styles.sheetBtns}>
              <TouchableOpacity style={styles.sheetBtn} onPress={() => setEditing(null)}>
                <Text style={styles.sheetBtnTxt}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetBtn} onPress={confirmDeleteSet}>
                <Text style={[styles.sheetBtnTxt, styles.sheetBtnDanger]}>{t('delete')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnPrimary]} onPress={saveEdit}>
                <Text style={styles.sheetBtnPrimaryTxt}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    pageTitle: { fontFamily: 'BebasNeue_400Regular', fontSize: 18, letterSpacing: 2, color: c.muted, marginBottom: 4 },
    pageHint: { fontSize: 11, color: c.muted, marginBottom: 16 },
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

    overlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    },
    sheet: {
      width: '100%', backgroundColor: c.surface, borderRadius: 12,
      borderWidth: 1, borderColor: c.border, padding: 18,
    },
    sheetTitle: { fontFamily: 'BebasNeue_400Regular', fontSize: 20, letterSpacing: 1, color: c.text },
    sheetSub: { fontSize: 13, color: c.accent, marginBottom: 14 },
    field: { marginBottom: 10 },
    fieldLabel: { fontSize: 11, color: c.muted, marginBottom: 4 },
    input: {
      backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border,
      borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
      fontSize: 16, color: c.text,
    },
    sheetBtns: { flexDirection: 'row', gap: 8, marginTop: 8 },
    sheetBtn: {
      flex: 1, paddingVertical: 11, borderRadius: 8, alignItems: 'center',
      borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2,
    },
    sheetBtnTxt: { fontSize: 14, color: c.text },
    sheetBtnDanger: { color: '#EF4444' },
    sheetBtnPrimary: { backgroundColor: c.accent, borderColor: c.accent },
    sheetBtnPrimaryTxt: { fontSize: 14, color: '#fff', fontWeight: '700' },
  });
}
