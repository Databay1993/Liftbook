import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, FlatList, Keyboard, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

import { Colors } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { TrackingType } from '../types';
import { useWorkout } from '../context/WorkoutContext';
import {
  getAllExercises, getLastSessionForExercise,
  saveExerciseSets, addCustomExercise, updateExerciseTrackingType, getHistory,
} from '../storage/database';
import { useTimer } from '../hooks/useTimer';
import TimerBubble from '../components/TimerBubble';
import Toast from '../components/Toast';
import WorkoutSummary from '../components/WorkoutSummary';

const REST_KEY = '@liftbook_rest';
const DEFAULT_REST = 90;

// ── Types ──────────────────────────────────────────────────────
interface WSet {
  reps: string;    // reps or duration-sec
  weight: string;  // kg or km
  isDone: boolean;
}
interface WExercise {
  name: string;
  trackingType: TrackingType;
  sets: WSet[];
  isCompleted: boolean;
}

// ── Tracking type config ───────────────────────────────────────
const TRACKING_TYPES: { value: TrackingType; labelKey: string }[] = [
  { value: 'weight_reps',   labelKey: 'trackWeightReps' },
  { value: 'bodyweight',    labelKey: 'trackBodyweight'  },
  { value: 'time',          labelKey: 'trackTime'        },
  { value: 'distance_time', labelKey: 'trackDistTime'    },
];

function formatDuration(sec: string): string {
  const s = parseInt(sec) || 0;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return m > 0 ? `${m}:${rest.toString().padStart(2, '0')}` : `${s}s`;
}

// ── Component ─────────────────────────────────────────────────
export default function WorkoutScreen({ navigation }: any) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { activeWorkout, setActiveWorkout, cancelWorkout } = useWorkout();
  const timer = useTimer();

  const [exercises, setExercises] = useState<WExercise[]>([]);
  const [showAddEx, setShowAddEx] = useState(false);
  const [exSearch, setExSearch] = useState('');
  const [newExName, setNewExName] = useState('');
  const [allExercises, setAllExercises] = useState<{ name: string; isCustom: boolean; trackingType: string }[]>([]);
  const [lastSessions, setLastSessions] = useState<Record<string, { date: string; sets: { reps: string; weight: string }[] } | null>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [restDuration, setRestDuration] = useState(DEFAULT_REST);
  const [summary, setSummary] = useState<{ totalSets: number; totalVolume: number; newPRs: string[] } | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  useEffect(() => {
    AsyncStorage.getItem(REST_KEY).then(v => { if (v) setRestDuration(parseInt(v)); });
    loadExercises();
  }, []);

  useEffect(() => {
    if (activeWorkout) {
      setExercises(activeWorkout.exercises as WExercise[]);
    }
  }, [activeWorkout?.workoutId]);

  async function loadExercises() {
    setAllExercises(await getAllExercises());
  }

  function closeSheet() {
    Keyboard.dismiss();
    setShowAddEx(false);
    setExSearch('');
    setNewExName('');
  }

  async function handleCreateAndAdd() {
    const name = newExName.trim();
    if (!name) return;
    try {
      await addCustomExercise(name);
      await loadExercises();
      setNewExName('');
      handleAddExercise(name);
    } catch {
      showToast(t('exerciseExists'));
    }
  }

  async function handleAddExercise(name: string) {
    if (exercises.find(e => e.name === name)) { showToast(t('alreadyAdded')); return; }
    const info = allExercises.find(e => e.name === name);
    const trackingType = (info?.trackingType ?? 'weight_reps') as TrackingType;
    const last = await getLastSessionForExercise(name);
    setLastSessions(prev => ({ ...prev, [name]: last }));
    const prefilled: WSet[] = last
      ? last.sets.map(s => ({ reps: s.reps, weight: s.weight, isDone: false }))
      : [];
    const newEx: WExercise = { name, trackingType, sets: prefilled, isCompleted: false };
    setExercises(prev => [...prev, newEx]);
    closeSheet();
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
  }

  function addSet(exName: string) {
    setExercises(prev => prev.map(ex => {
      if (ex.name !== exName) return ex;
      const last = ex.sets[ex.sets.length - 1];
      return { ...ex, sets: [...ex.sets, { reps: last?.reps || '', weight: last?.weight || '', isDone: false }] };
    }));
  }

  function updateSet(exName: string, idx: number, field: 'reps' | 'weight', value: string) {
    setExercises(prev => prev.map(ex => {
      if (ex.name !== exName) return ex;
      return { ...ex, sets: ex.sets.map((s, i) => i === idx ? { ...s, [field]: value } : s) };
    }));
  }

  function toggleSetDone(exName: string, idx: number) {
    setExercises(prev => prev.map(ex => {
      if (ex.name !== exName) return ex;
      const sets = ex.sets.map((s, i) => {
        if (i !== idx) return s;
        const nowDone = !s.isDone;
        if (nowDone) timer.start(restDuration);
        else timer.cancel();
        return { ...s, isDone: nowDone };
      });
      return { ...ex, sets };
    }));
  }

  function removeSet(exName: string, idx: number) {
    setExercises(prev => prev.map(ex => {
      if (ex.name !== exName) return ex;
      return { ...ex, sets: ex.sets.filter((_, i) => i !== idx) };
    }));
  }

  function removeExercise(name: string) {
    setExercises(prev => prev.filter(e => e.name !== name));
  }

  async function completeExercise(exName: string) {
    const ex = exercises.find(e => e.name === exName);
    if (!ex) return;

    // Toggle: if already completed → undo
    if (ex.isCompleted) {
      setExercises(prev => prev.map(e => e.name === exName ? { ...e, isCompleted: false } : e));
      return;
    }

    if (!activeWorkout?.workoutId) return;
    const validSets = ex.sets.filter(s => s.reps || s.weight);
    if (validSets.length === 0) { showToast('No sets to save'); return; }

    await saveExerciseSets(activeWorkout.workoutId, exName, validSets);
    setExercises(prev => prev.map(e => e.name === exName ? { ...e, isCompleted: true } : e));
    showToast(t('exerciseSaved'));
  }

  async function changeTrackingType(exName: string, type: TrackingType) {
    await updateExerciseTrackingType(exName, type);
    setExercises(prev => prev.map(ex =>
      ex.name === exName ? { ...ex, trackingType: type, sets: ex.sets.map(s => ({ ...s, reps: '', weight: '' })) } : ex
    ));
    await loadExercises();
  }

  function calcRepsHint(lastReps: string, lastWeight: string, newWeight: string): number | null {
    const r = parseFloat(lastReps), w = parseFloat(lastWeight), nw = parseFloat(newWeight);
    if (!r || !w || !nw || nw === w) return null;
    const est = Math.round((w * (1 + r / 30) / nw - 1) * 30);
    return est >= 1 && est <= 50 ? est : null;
  }

  async function handleSave() {
    if (!activeWorkout?.workoutId) return;

    const toSave = exercises
      .filter(ex => !ex.isCompleted)
      .map(ex => ({ name: ex.name, sets: ex.sets.filter(s => s.isDone || s.reps || s.weight) }))
      .filter(ex => ex.sets.length > 0);

    for (const ex of toSave) {
      await saveExerciseSets(activeWorkout.workoutId, ex.name, ex.sets);
    }

    const allSaved = [
      ...exercises.filter(e => e.isCompleted),
      ...toSave.map(ex => ({ ...ex, isCompleted: false })),
    ];

    if (allSaved.length === 0) { showToast(t('noExercisesLogged')); return; }

    const totalSets = allSaved.reduce((s, ex) => s + ex.sets.length, 0);
    const totalVolume = Math.round(
      allSaved.reduce((s, ex) => s + ex.sets.reduce((ss, set) => {
        const r = parseFloat(set.reps) || 0;
        const w = parseFloat(set.weight) || 0;
        return ss + r * w;
      }, 0), 0)
    );

    const history = await getHistory();
    const newPRs: string[] = [];
    for (const ex of allSaved) {
      const maxNew = Math.max(...ex.sets.map(s => parseFloat(s.weight) || 0));
      const prevMax = Math.max(0, ...history.filter(r => r.exerciseName === ex.name).map(r => parseFloat(r.weight) || 0));
      if (maxNew > prevMax && prevMax > 0) newPRs.push(ex.name);
    }

    setActiveWorkout(null);
    setSummary({ totalSets, totalVolume, newPRs });
  }

  function handleCancel() {
    Alert.alert(t('cancelWorkout'), '', [
      { text: t('cancel'), style: 'cancel' },
      { text: t('confirm'), style: 'destructive', onPress: () => { timer.cancel(); cancelWorkout(); } },
    ]);
  }

  const filtered = allExercises.filter(e => e.name.toLowerCase().includes(exSearch.toLowerCase()));

  // ── No active workout ────────────────────────────────────────
  if (!activeWorkout) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: 40, marginBottom: 16 }}>💤</Text>
        <Text style={styles.noWorkoutTitle}>{t('noActiveWorkout')}</Text>
        <Text style={styles.noWorkoutSub}>{t('startFromHome')}</Text>
        <TouchableOpacity style={[styles.btnPrimary, { marginTop: 28, paddingHorizontal: 32 }]} onPress={() => navigation.navigate('HomeTab')}>
          <Text style={styles.btnPrimaryText}>← {t('home')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Active workout ───────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>LIFTBOOK</Text>
        <View style={styles.headerBtns}>
          <TouchableOpacity style={styles.navBtn} onPress={() => navigation.navigate('StatsTab')}>
            <Text style={styles.navBtnText}>📊</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn} onPress={() => navigation.navigate('HistoryTab')}>
            <Text style={styles.navBtnText}>{t('historyTab')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.navBtn, { borderColor: colors.danger }]} onPress={handleCancel}>
            <Text style={[styles.navBtnText, { color: colors.danger }]}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}>
        <View style={styles.workoutTitleRow}>
          <Text style={styles.sectionTitle}>{t('workout').toUpperCase()}</Text>
          <Text style={styles.dateText}>
            {new Date(activeWorkout.date).toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'long' })}
          </Text>
        </View>

        {exercises.length === 0 && <Text style={styles.emptyState}>{t('noExercises')}</Text>}

        {exercises.map(ex => {
          const last = lastSessions[ex.name];
          const disabled = ex.isCompleted;

          return (
            <View key={ex.name} style={[styles.exerciseCard, disabled && styles.exerciseCardDone]}>
              {/* Exercise header */}
              <View style={styles.exHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exName}>{ex.name}</Text>
                  {/* Tracking type pills */}
                  {!disabled && (
                    <View style={styles.trackingPills}>
                      {TRACKING_TYPES.map(tt => (
                        <TouchableOpacity
                          key={tt.value}
                          style={[styles.pill, ex.trackingType === tt.value && styles.pillActive]}
                          onPress={() => changeTrackingType(ex.name, tt.value)}
                        >
                          <Text style={[styles.pillTxt, ex.trackingType === tt.value && styles.pillTxtActive]}>
                            {t(tt.labelKey as any)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                <View style={styles.exHeaderRight}>
                  {/* Exercise-level done button */}
                  <TouchableOpacity
                    style={[styles.exDoneBtn, disabled && styles.exDoneBtnActive]}
                    onPress={() => completeExercise(ex.name)}
                  >
                    <Text style={[styles.exDoneBtnTxt, disabled && { color: '#000' }]}>
                      {disabled ? '✓' : '○'}
                    </Text>
                  </TouchableOpacity>
                  {!disabled && (
                    <TouchableOpacity onPress={() => removeExercise(ex.name)}>
                      <Text style={styles.removeBtn}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Last session */}
              {last ? (
                <View style={styles.lastSession}>
                  <Text style={styles.lastLabel}>
                    {t('lastSession')} · {new Date(last.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                  </Text>
                  <View style={styles.lastChips}>
                    {last.sets.map((s, i) => (
                      <View key={i} style={styles.lastChip}>
                        <Text style={styles.lastChipText}>
                          {ex.trackingType === 'time'
                            ? `S${i + 1}: ${formatDuration(s.reps)}`
                            : ex.trackingType === 'bodyweight'
                            ? `S${i + 1}: ${s.reps} reps`
                            : ex.trackingType === 'distance_time'
                            ? `S${i + 1}: ${s.weight}km · ${formatDuration(s.reps)}`
                            : `S${i + 1}: ${s.reps}×${s.weight}kg`}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <Text style={styles.noHistory}>{t('firstTime')}</Text>
              )}

              {/* Sets */}
              {!disabled && (
                <View style={styles.setsBody}>
                  {ex.sets.map((s, idx) => {
                    const hint = ex.trackingType === 'weight_reps' && last?.sets[idx]
                      ? calcRepsHint(last.sets[idx].reps, last.sets[idx].weight, s.weight)
                      : null;
                    return (
                      <View key={idx} style={styles.setRow}>
                        <Text style={styles.setNum}>{idx + 1}</Text>

                        {ex.trackingType === 'weight_reps' && (
                          <>
                            <TextInput
                              style={[styles.setInput, s.isDone && styles.setInputDone]}
                              keyboardType="numeric"
                              placeholder={t('reps')}
                              placeholderTextColor={colors.muted}
                              value={s.reps}
                              onChangeText={v => updateSet(ex.name, idx, 'reps', v)}
                              editable={!s.isDone}
                            />
                            <View>
                              <TextInput
                                style={[styles.setInput, s.isDone && styles.setInputDone]}
                                keyboardType="decimal-pad"
                                placeholder={t('kg')}
                                placeholderTextColor={colors.muted}
                                value={s.weight}
                                onChangeText={v => updateSet(ex.name, idx, 'weight', v)}
                                editable={!s.isDone}
                              />
                              {hint !== null && <Text style={styles.repsHint}>~{hint} {t('reps')}</Text>}
                            </View>
                          </>
                        )}

                        {ex.trackingType === 'bodyweight' && (
                          <TextInput
                            style={[styles.setInput, styles.setInputWide, s.isDone && styles.setInputDone]}
                            keyboardType="numeric"
                            placeholder={t('reps')}
                            placeholderTextColor={colors.muted}
                            value={s.reps}
                            onChangeText={v => updateSet(ex.name, idx, 'reps', v)}
                            editable={!s.isDone}
                          />
                        )}

                        {ex.trackingType === 'time' && (
                          <View>
                            <TextInput
                              style={[styles.setInput, styles.setInputWide, s.isDone && styles.setInputDone]}
                              keyboardType="numeric"
                              placeholder={t('durationSec')}
                              placeholderTextColor={colors.muted}
                              value={s.reps}
                              onChangeText={v => updateSet(ex.name, idx, 'reps', v)}
                              editable={!s.isDone}
                            />
                            {s.reps ? <Text style={styles.repsHint}>{formatDuration(s.reps)}</Text> : null}
                          </View>
                        )}

                        {ex.trackingType === 'distance_time' && (
                          <>
                            <TextInput
                              style={[styles.setInput, s.isDone && styles.setInputDone]}
                              keyboardType="decimal-pad"
                              placeholder={t('distanceKm')}
                              placeholderTextColor={colors.muted}
                              value={s.weight}
                              onChangeText={v => updateSet(ex.name, idx, 'weight', v)}
                              editable={!s.isDone}
                            />
                            <TextInput
                              style={[styles.setInput, s.isDone && styles.setInputDone]}
                              keyboardType="numeric"
                              placeholder={t('durationSec')}
                              placeholderTextColor={colors.muted}
                              value={s.reps}
                              onChangeText={v => updateSet(ex.name, idx, 'reps', v)}
                              editable={!s.isDone}
                            />
                          </>
                        )}

                        {/* Set done toggle */}
                        <TouchableOpacity
                          style={[styles.checkBtn, s.isDone && styles.checkBtnDone]}
                          onPress={() => toggleSetDone(ex.name, idx)}
                        >
                          <Text style={[styles.checkBtnText, s.isDone && { color: '#000' }]}>
                            {s.isDone ? '✓' : '○'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => removeSet(ex.name, idx)}>
                          <Text style={styles.delBtn}>×</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                  <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(ex.name)}>
                    <Text style={styles.addSetText}>{t('addSet')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {disabled && (
                <View style={styles.completedBanner}>
                  <Text style={styles.completedBannerTxt}>✓ {t('exerciseSaved')}</Text>
                </View>
              )}
            </View>
          );
        })}

        <TouchableOpacity style={styles.addExBtn} onPress={() => setShowAddEx(true)}>
          <Text style={styles.addExText}>{t('addExercise')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.btnPrimary} onPress={handleSave}>
          <Text style={styles.btnPrimaryText}>{t('saveWorkout')}</Text>
        </TouchableOpacity>
      </View>

      {timer.seconds !== null && (
        <TimerBubble seconds={timer.seconds} maxSeconds={timer.maxSeconds} onCancel={timer.cancel} />
      )}

      {/* Exercise picker */}
      <Modal visible={showAddEx} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeSheet}>
        <SafeAreaView style={styles.pickerScreen}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{t('chooseExercise')}</Text>
              <TouchableOpacity style={styles.closeSheetBtn} onPress={closeSheet}>
                <Text style={styles.closeSheetText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pickerSearchWrap}>
              <TextInput
                style={styles.textInput}
                placeholder={t('search')}
                placeholderTextColor={colors.muted}
                value={exSearch}
                onChangeText={setExSearch}
                autoFocus
                returnKeyType="search"
              />
            </View>

            <FlatList
              data={filtered}
              keyExtractor={item => item.name}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ paddingHorizontal: 16 }}
              renderItem={({ item }) => {
                const added = exercises.find(e => e.name === item.name);
                return (
                  <TouchableOpacity style={styles.exListItem} onPress={() => handleAddExercise(item.name)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.exListText}>{item.name}</Text>
                      {item.isCustom && <Text style={styles.customTag}>{t('custom')}</Text>}
                    </View>
                    {added && <Text style={styles.addedCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />

            <View style={styles.newExSection}>
              <Text style={styles.newExLabel}>{t('newExercise')}</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  placeholder={t('exerciseName')}
                  placeholderTextColor={colors.muted}
                  value={newExName}
                  onChangeText={setNewExName}
                  onSubmitEditing={handleCreateAndAdd}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.addNewExBtn} onPress={handleCreateAndAdd}>
                  <Text style={styles.addNewExText}>+ {t('add')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {toast && <Toast message={toast} />}

      {summary && (
        <WorkoutSummary
          visible={!!summary}
          totalSets={summary.totalSets}
          totalVolume={summary.totalVolume}
          newPRs={summary.newPRs}
          onClose={() => { setSummary(null); navigation.navigate('HomeTab'); }}
        />
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────
function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },

    noWorkoutTitle: { fontFamily: 'BebasNeue_400Regular', fontSize: 28, letterSpacing: 2, color: c.text, textAlign: 'center' },
    noWorkoutSub:  { fontSize: 14, color: c.muted, textAlign: 'center', marginTop: 8 },

    header: {
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      paddingHorizontal: 18,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    logo: { fontFamily: 'BebasNeue_400Regular', fontSize: 26, letterSpacing: 3, color: c.accent },
    headerBtns: { flexDirection: 'row', gap: 8 },
    navBtn: { borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
    navBtnText: { color: c.muted, fontSize: 13 },

    scroll: { flex: 1 },
    content: { padding: 16 },
    workoutTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 },
    sectionTitle: { fontFamily: 'BebasNeue_400Regular', fontSize: 18, letterSpacing: 2, color: c.muted },
    dateText: { fontSize: 12, color: c.muted },
    emptyState: { textAlign: 'center', color: c.muted, paddingVertical: 40, fontSize: 14, lineHeight: 22 },

    exerciseCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      marginBottom: 12,
      overflow: 'hidden',
    },
    exerciseCardDone: { borderColor: c.accent, opacity: 0.75 },

    exHeader: { padding: 14, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    exName: { fontWeight: '600', fontSize: 16, color: c.text, marginBottom: 6 },
    exHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 8 },

    exDoneBtn: {
      width: 36, height: 36,
      backgroundColor: c.surface2,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    exDoneBtnActive: { backgroundColor: c.accent, borderColor: c.accent },
    exDoneBtnTxt: { color: c.muted, fontSize: 16, fontWeight: '700' },

    removeBtn: { color: c.muted, fontSize: 16, padding: 4 },

    trackingPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    pill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface2,
    },
    pillActive: { borderColor: c.accent, backgroundColor: c.accentBg },
    pillTxt: { fontSize: 10, color: c.muted },
    pillTxtActive: { color: c.accent, fontWeight: '600' },

    lastSession: { padding: 10, paddingHorizontal: 16, backgroundColor: 'rgba(232,255,74,0.05)', borderTopWidth: 1, borderTopColor: 'rgba(232,255,74,0.12)' },
    lastLabel: { fontSize: 10, color: c.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
    lastChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    lastChip: { backgroundColor: c.accentBg, borderWidth: 1, borderColor: c.accentBorder, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
    lastChipText: { fontSize: 12, color: c.accent },
    noHistory: { fontSize: 12, color: c.muted, padding: 10, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: c.border },

    setsBody: { padding: 12, borderTopWidth: 1, borderTopColor: c.border },
    setRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 7 },
    setNum: { fontFamily: 'BebasNeue_400Regular', fontSize: 18, color: c.muted, width: 26, textAlign: 'center', paddingTop: 8 },
    setInput: {
      width: 70,
      backgroundColor: c.surface2,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      paddingVertical: 9,
      paddingHorizontal: 6,
      borderRadius: 6,
      fontSize: 15,
      textAlign: 'center',
    },
    setInputWide: { width: 110 },
    setInputDone: { borderColor: c.accentBorder, backgroundColor: c.accentBg, color: c.accent },
    repsHint: {
      fontSize: 11,
      color: c.accent2,
      backgroundColor: 'rgba(255,107,53,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255,107,53,0.25)',
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 1,
      marginTop: 2,
      textAlign: 'center',
    },
    checkBtn: { width: 38, height: 38, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    checkBtnDone: { backgroundColor: c.accent, borderColor: c.accent },
    checkBtnText: { color: c.muted, fontSize: 16, fontWeight: '700' },
    delBtn: { color: c.muted, fontSize: 22, width: 34, height: 38, textAlign: 'center', lineHeight: 38 },
    addSetBtn: { borderWidth: 1, borderColor: c.border, borderStyle: 'dashed', borderRadius: 6, padding: 10, alignItems: 'center', marginTop: 4 },
    addSetText: { color: c.muted, fontSize: 13 },

    completedBanner: { padding: 10, alignItems: 'center', backgroundColor: c.accentBg, borderTopWidth: 1, borderTopColor: c.accentBorder },
    completedBannerTxt: { color: c.accent, fontSize: 13, fontWeight: '600' },

    addExBtn: { backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, padding: 13, borderRadius: 6, alignItems: 'center', marginTop: 4 },
    addExText: { color: c.text, fontSize: 15 },

    footer: { backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border, padding: 12 },
    btnPrimary: { backgroundColor: c.accent, paddingVertical: 15, borderRadius: 6, alignItems: 'center' },
    btnPrimaryText: { fontFamily: 'BebasNeue_400Regular', fontSize: 20, letterSpacing: 2, color: '#000' },

    pickerScreen: { backgroundColor: c.bg, flex: 1 },
    pickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.surface,
    },
    pickerTitle: { fontFamily: 'BebasNeue_400Regular', fontSize: 22, letterSpacing: 2, color: c.text },
    pickerSearchWrap: { padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
    closeSheetBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    closeSheetText: { color: c.muted, fontSize: 14 },
    newExSection: { borderTopWidth: 1, borderTopColor: c.border, padding: 16, backgroundColor: c.surface },
    newExLabel: { fontFamily: 'BebasNeue_400Regular', fontSize: 14, letterSpacing: 1, color: c.muted, marginBottom: 8 },
    inputRow: { flexDirection: 'row', gap: 8 },
    addNewExBtn: { backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    addNewExText: { color: c.text, fontSize: 14 },
    textInput: {
      backgroundColor: c.surface2,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 6,
      fontSize: 15,
    },
    exListItem: { paddingVertical: 13, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: c.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    exListText: { fontSize: 15, color: c.text },
    customTag: { fontSize: 10, color: c.accent2, backgroundColor: 'rgba(255,107,53,0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    addedCheck: { fontSize: 14, color: c.accent },
  });
}
