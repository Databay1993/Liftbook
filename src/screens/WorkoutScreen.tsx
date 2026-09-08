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
  saveExerciseSets, addCustomExercise, updateExerciseTrackingType,
  updateExerciseRestTime, updateExerciseHasSides, getHistory, updateExerciseOrder,
  getExerciseSets, getWorkoutCompositions, updateExerciseExtraFields, ExtraField,
} from '../storage/database';
import {
  buildE1RMSeries, analyzeContexts, contextKey, estimateReps, formatSetWithExtras, formatDuration,
  weightForReps, REP_TARGETS,
  ContextAnalysis, RepsEstimate,
} from '../lib/analytics';
import { loadSetRule } from '../lib/setRule';
import { useTimer } from '../hooks/useTimer';
import { exerciseLabel, matchesExercise } from '../lib/exerciseName';
import TimerBubble from '../components/TimerBubble';
import Toast from '../components/Toast';
import WorkoutSummary from '../components/WorkoutSummary';

const REST_KEY = '@liftbook_rest';
const DEFAULT_REST = 90;

// ── Types ──────────────────────────────────────────────────────
interface WSet {
  reps: string;            // reps, or duration in seconds
  weight: string;          // kg, km, or percent — whatever the load axis is
  isDone: boolean;
  side?: 'left' | 'right';
  timerRunning?: boolean;
  timerStartedAt?: number;
  /** User-defined measurements, keyed by field id. */
  extras: Record<string, string>;
}
interface WExercise {
  name: string;
  trackingType: TrackingType;
  sets: WSet[];
  isCompleted: boolean;
  restTime: number | null;
  showRestPicker: boolean;
  hasSides: boolean;
  /** Extra numbers this exercise records beyond reps and load. */
  extraFields: ExtraField[];
  /** Cards start folded so a long workout stays scannable. */
  collapsed: boolean;
}

// ── Tracking type config ───────────────────────────────────────
const TRACKING_TYPES: { value: TrackingType; labelKey: string }[] = [
  { value: 'weight_reps',   labelKey: 'trackWeightReps' },
  { value: 'bodyweight',    labelKey: 'trackBodyweight'  },
  { value: 'time',          labelKey: 'trackTime'        },
  { value: 'distance_time', labelKey: 'trackDistTime'    },
  { value: 'percent',       labelKey: 'trackPercent'     },
];

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
  const [allExercises, setAllExercises] = useState<{ name: string; isCustom: boolean; trackingType: string; restTime: number | null; hasSides: boolean; muscleGroup: string | null; extraFields: ExtraField[] }[]>([]);
  const [contexts, setContexts] = useState<Record<string, ContextAnalysis>>({});
  const [lastSessions, setLastSessions] = useState<Record<string, {
    date: string;
    sets: { reps: string; weight: string; side?: string; extras?: Record<string, string> }[];
  } | null>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [restDuration, setRestDuration] = useState(DEFAULT_REST);
  const [summary, setSummary] = useState<{ totalSets: number; totalVolume: number; newPRs: string[] } | null>(null);
  const [fieldsFor, setFieldsFor] = useState<string | null>(null);   // exercise whose extra fields are being edited
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldUnit, setNewFieldUnit] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // ── Set-level timer tick ──────────────────────────────────
  const [, setTimerTick] = useState(0);
  const setTimerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const anyTimerRunning = exercises.some(ex => ex.sets.some(s => s.timerRunning));

  useEffect(() => {
    if (anyTimerRunning) {
      setTimerIntervalRef.current = setInterval(() => setTimerTick(t => t + 1), 1000);
    } else {
      if (setTimerIntervalRef.current) {
        clearInterval(setTimerIntervalRef.current);
        setTimerIntervalRef.current = null;
      }
    }
    return () => {
      if (setTimerIntervalRef.current) {
        clearInterval(setTimerIntervalRef.current);
        setTimerIntervalRef.current = null;
      }
    };
  }, [anyTimerRunning]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  useEffect(() => {
    AsyncStorage.getItem(REST_KEY).then(v => { if (v) setRestDuration(parseInt(v)); });
    loadExercises();
  }, [activeWorkout?.workoutId]);

  useEffect(() => {
    if (activeWorkout) {
      // Resuming shows the plan, not eight open cards
      setExercises((activeWorkout.exercises as WExercise[]).map(e => ({ ...e, collapsed: true })));
      hydrateExercises(activeWorkout.exercises.map(e => e.name));
    }
  }, [activeWorkout?.workoutId]);

  /**
   * Fills in everything an exercise needs beyond its name.
   *
   * Starting from a plan creates entries that carry nothing but the name, so
   * without this they would show as never trained, default to weight+reps
   * whatever they actually track, and lose their rest time and L/R setting.
   */
  async function hydrateExercises(names: string[]) {
    if (names.length === 0) return;
    const [all, rule] = await Promise.all([getAllExercises(), loadSetRule()]);
    setAllExercises(all);

    for (const name of names) {
      const info = all.find(e => e.name === name);
      const [last, sets, compositions] = await Promise.all([
        getLastSessionForExercise(name),
        getExerciseSets(name),
        getWorkoutCompositions(name),
      ]);

      setLastSessions(prev => ({ ...prev, [name]: last }));
      setContexts(prev => ({
        ...prev,
        [name]: analyzeContexts(buildE1RMSeries(sets, rule), compositions, name, info?.muscleGroup ?? null),
      }));

      setExercises(prev => prev.map(ex => {
        if (ex.name !== name) return ex;
        return {
          ...ex,
          trackingType: (info?.trackingType ?? ex.trackingType) as TrackingType,
          restTime: info?.restTime ?? ex.restTime ?? null,
          hasSides: info?.hasSides ?? ex.hasSides ?? false,
          extraFields: info?.extraFields ?? ex.extraFields ?? [],
          // Only where nothing is logged yet — coming back to a workout must
          // never overwrite sets already entered
          sets: ex.sets.length === 0 && last
            ? last.sets.map(s => ({
                reps: s.reps,
                weight: s.weight,
                isDone: false,
                side: s.side as 'left' | 'right' | undefined,
                extras: {},
              }))
            : ex.sets,
        };
      }));
    }
  }

  async function loadExercises() {
    setAllExercises(await getAllExercises());
  }

  function closeSheet() {
    Keyboard.dismiss();
    setShowAddEx(false);
    setExSearch('');
  }

  async function handleCreateAndAdd(raw: string) {
    const name = raw.trim();
    if (!name) return;
    try {
      await addCustomExercise(name);
      await loadExercises();
      setExSearch('');
      handleAddExercise(name);
    } catch {
      showToast(t('exerciseExists'));
    }
  }

  async function handleAddExercise(name: string) {
    if (exercises.find(e => e.name === name)) { showToast(t('alreadyAdded')); return; }
    const info = allExercises.find(e => e.name === name);
    const trackingType = (info?.trackingType ?? 'weight_reps') as TrackingType;
    const hasSides = info?.hasSides ?? false;
    const last = await getLastSessionForExercise(name);
    setLastSessions(prev => ({ ...prev, [name]: last }));

    // History grouped by fatigue context, so the rep hint can compare today
    // against sessions trained in the same situation rather than any session
    const [sets, compositions, rule] = await Promise.all([
      getExerciseSets(name), getWorkoutCompositions(name), loadSetRule(),
    ]);
    setContexts(prev => ({
      ...prev,
      [name]: analyzeContexts(buildE1RMSeries(sets, rule), compositions, name, info?.muscleGroup ?? null),
    }));
    const prefilled: WSet[] = last
      ? last.sets.map(s => ({
          reps: s.reps, weight: s.weight, isDone: false,
          side: s.side as 'left' | 'right' | undefined,
          extras: {},   // measured values belong to that session, not to this one
        }))
      : [];
    const newEx: WExercise = {
      name, trackingType, sets: prefilled, isCompleted: false,
      restTime: info?.restTime ?? null, showRestPicker: false, hasSides,
      extraFields: info?.extraFields ?? [],
      collapsed: false,   // just added means about to be logged
    };
    setExercises(prev => [...prev, newEx]);
    closeSheet();
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
  }

  function updateExtra(exName: string, idx: number, fieldId: string, value: string) {
    setExercises(prev => prev.map(ex => {
      if (ex.name !== exName) return ex;
      return {
        ...ex,
        sets: ex.sets.map((s, i) =>
          i === idx ? { ...s, extras: { ...s.extras, [fieldId]: value } } : s
        ),
      };
    }));
  }

  /**
   * Extra fields belong to the exercise, not to one workout, so adding one
   * here also defines it for every future session of that exercise.
   */
  async function addExtraField(exName: string) {
    const label = newFieldLabel.trim();
    if (!label) return;

    const ex = exercises.find(e => e.name === exName);
    if (!ex) return;
    if (ex.extraFields.some(f => f.label.toLowerCase() === label.toLowerCase())) {
      showToast(t('fieldExists'));
      return;
    }

    const field: ExtraField = {
      // Time-free id: a label can be renamed later without orphaning values
      id: `f${ex.extraFields.length + 1}_${label.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}`,
      label,
      unit: newFieldUnit.trim(),
    };
    const next = [...ex.extraFields, field];

    await updateExerciseExtraFields(exName, next);
    setExercises(prev => prev.map(e => e.name === exName ? { ...e, extraFields: next } : e));
    await loadExercises();
    setNewFieldLabel('');
    setNewFieldUnit('');
  }

  async function removeExtraField(exName: string, fieldId: string) {
    const ex = exercises.find(e => e.name === exName);
    if (!ex) return;
    const next = ex.extraFields.filter(f => f.id !== fieldId);
    await updateExerciseExtraFields(exName, next);
    setExercises(prev => prev.map(e => e.name === exName ? { ...e, extraFields: next } : e));
    await loadExercises();
  }

  function toggleCollapsed(exName: string) {
    setExercises(prev => prev.map(ex =>
      ex.name === exName ? { ...ex, collapsed: !ex.collapsed } : ex
    ));
  }

  function setAllCollapsed(collapsed: boolean) {
    setExercises(prev => prev.map(ex => ({ ...ex, collapsed })));
  }

  /**
   * Moves an exercise within the workout. Anything already saved carries its
   * old position on disk, so the stored order is rewritten too — the
   * comparison later reads exactly that to decide what is comparable.
   */
  function moveExercise(index: number, dir: -1 | 1) {
    const to = index + dir;
    if (to < 0 || to >= exercises.length) return;

    const reordered = [...exercises];
    [reordered[index], reordered[to]] = [reordered[to], reordered[index]];
    setExercises(reordered);

    if (activeWorkout?.workoutId) {
      updateExerciseOrder(activeWorkout.workoutId, reordered.map(e => e.name)).catch(() => {});
    }
  }

  /** One line describing a folded card, so it stays useful while closed. */
  function collapsedSummary(ex: WExercise): string {
    const filled = ex.sets.filter(s => s.reps || s.weight);
    if (filled.length === 0) return t('noSetsYet');
    const done = ex.sets.filter(s => s.isDone).length;
    const first = filled[0];
    const detail = formatSetWithExtras(
      { reps: first.reps, weight: first.weight, side: first.side ?? null, extras: first.extras ?? {} },
      ex.trackingType,
      ex.extraFields,
    );
    return `${filled.length} ${t('sets')} · ${detail}${done > 0 ? ` · ${done} ✓` : ''}`;
  }

  function addSet(exName: string) {
    setExercises(prev => prev.map(ex => {
      if (ex.name !== exName) return ex;
      const last = ex.sets[ex.sets.length - 1];
      if (ex.hasSides) {
        // Add L+R pair
        const base = { reps: last?.reps || '', weight: last?.weight || '', isDone: false, extras: {} };
        return { ...ex, sets: [...ex.sets, { ...base, side: 'left' as const }, { ...base, side: 'right' as const }] };
      }
      return { ...ex, sets: [...ex.sets, { reps: last?.reps || '', weight: last?.weight || '', isDone: false, extras: {} }] };
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
        if (nowDone) timer.start(ex.restTime ?? restDuration);
        else timer.cancel();
        return { ...s, isDone: nowDone, timerRunning: false };
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

  // ── Side toggles ──────────────────────────────────────────
  async function toggleHasSides(exName: string) {
    const ex = exercises.find(e => e.name === exName);
    if (!ex) return;
    const next = !ex.hasSides;
    setExercises(prev => prev.map(e => {
      if (e.name !== exName) return e;
      const sets = next
        ? e.sets.map((s, i) => ({ ...s, side: (i % 2 === 0 ? 'left' : 'right') as 'left' | 'right' }))
        : e.sets.map(s => ({ ...s, side: undefined }));
      return { ...e, hasSides: next, sets };
    }));
    await updateExerciseHasSides(exName, next);
  }

  function toggleSetSide(exName: string, idx: number) {
    setExercises(prev => prev.map(ex => {
      if (ex.name !== exName) return ex;
      return {
        ...ex,
        sets: ex.sets.map((s, i) =>
          i === idx ? { ...s, side: s.side === 'left' ? 'right' : 'left' } : s
        ),
      };
    }));
  }

  // ── Set-level timer (for 'time' tracking) ─────────────────
  function startSetTimer(exName: string, idx: number) {
    setExercises(prev => prev.map(ex => {
      if (ex.name !== exName) return ex;
      return {
        ...ex,
        sets: ex.sets.map((s, i) =>
          i === idx ? { ...s, timerRunning: true, timerStartedAt: Date.now() } : s
        ),
      };
    }));
  }

  function stopSetTimer(exName: string, idx: number) {
    setExercises(prev => prev.map(ex => {
      if (ex.name !== exName) return ex;
      return {
        ...ex,
        sets: ex.sets.map((s, i) => {
          if (i !== idx) return s;
          const elapsed = s.timerStartedAt ? Math.floor((Date.now() - s.timerStartedAt) / 1000) : 0;
          return { ...s, reps: String(elapsed), timerRunning: false, timerStartedAt: undefined };
        }),
      };
    }));
  }

  async function completeExercise(exName: string) {
    const ex = exercises.find(e => e.name === exName);
    if (!ex) return;

    if (ex.isCompleted) {
      setExercises(prev => prev.map(e => e.name === exName ? { ...e, isCompleted: false } : e));
      return;
    }

    if (!activeWorkout?.workoutId) return;
    const validSets = ex.sets.filter(s => s.reps || s.weight);
    if (validSets.length === 0) { showToast('No sets to save'); return; }

    // Position in the workout is what makes later comparisons fair —
    // rowing after pull-ups is not the same as rowing done first.
    const order = exercises.findIndex(e => e.name === exName);
    await saveExerciseSets(activeWorkout.workoutId, exName, validSets.map(s => ({
      reps: s.reps, weight: s.weight, side: s.side, extras: s.extras,
    })), order);
    setExercises(prev => prev.map(e => e.name === exName ? { ...e, isCompleted: true } : e));
    showToast(t('exerciseSaved'));
  }

  function toggleRestPicker(exName: string) {
    setExercises(prev => prev.map(ex =>
      ex.name === exName ? { ...ex, showRestPicker: !ex.showRestPicker } : { ...ex, showRestPicker: false }
    ));
  }

  async function changeExRestTime(exName: string, delta: number) {
    setExercises(prev => prev.map(ex => {
      if (ex.name !== exName) return ex;
      const current = ex.restTime ?? restDuration;
      const next = Math.min(600, Math.max(10, current + delta));
      updateExerciseRestTime(exName, next).catch(() => {});
      return { ...ex, restTime: next };
    }));
  }

  async function resetExRestTime(exName: string) {
    await updateExerciseRestTime(exName, null);
    setExercises(prev => prev.map(ex =>
      ex.name === exName ? { ...ex, restTime: null, showRestPicker: false } : ex
    ));
  }

  async function changeTrackingType(exName: string, type: TrackingType) {
    await updateExerciseTrackingType(exName, type);
    setExercises(prev => prev.map(ex =>
      ex.name === exName ? { ...ex, trackingType: type, sets: ex.sets.map(s => ({ ...s, reps: '', weight: '' })) } : ex
    ));
    await loadExercises();
  }

  /**
   * Today's fatigue context for an exercise, built from the workout as it
   * stands right now — adding another back exercise above it changes what
   * this exercise is comparable to, so it is derived at render time.
   */
  function todayContextKey(exName: string): string | null {
    const groupOf = new Map<string, string | null>(
      allExercises.map(e => [e.name, e.muscleGroup] as [string, string | null]),
    );
    const composition = {
      workoutId: activeWorkout?.workoutId ?? 0,
      date: activeWorkout?.date ?? '',
      orderInferred: false,
      exercises: exercises.map(e => ({ name: e.name, muscleGroup: groupOf.get(e.name) ?? null })),
    };
    return contextKey(composition, exName, groupOf.get(exName) ?? null);
  }

  /**
   * What the entered weight should be good for, based on sessions trained
   * under the same pre-fatigue as today rather than on whatever came last.
   */
  function repsHintFor(exName: string, weight: string): RepsEstimate | null {
    const analysis = contexts[exName];
    const w = parseFloat(weight);
    if (!analysis || !w) return null;
    return estimateReps(analysis, todayContextKey(exName), w);
  }

  async function handleSave() {
    if (!activeWorkout?.workoutId) return;

    const toSave = exercises
      .filter(ex => !ex.isCompleted)
      .map(ex => ({ name: ex.name, sets: ex.sets.filter(s => s.isDone || s.reps || s.weight) }))
      .filter(ex => ex.sets.length > 0);

    for (const ex of toSave) {
      const order = exercises.findIndex(e => e.name === ex.name);
      await saveExerciseSets(activeWorkout.workoutId, ex.name, ex.sets.map(s => ({
        reps: (s as WSet).reps,
        weight: (s as WSet).weight,
        side: (s as WSet).side,
        extras: (s as WSet).extras,
      })), order);
    }

    const allSaved = [
      ...exercises.filter(e => e.isCompleted),
      ...toSave.map(ex => ({ ...ex, isCompleted: false })),
    ];

    if (allSaved.length === 0) { showToast(t('noExercisesLogged')); return; }

    const totalSets = allSaved.reduce((s, ex) => s + ex.sets.length, 0);
    const totalVolume = Math.round(
      allSaved.reduce((s, ex) => s + ex.sets.reduce((ss, set) => {
        const r = parseFloat((set as WSet).reps) || 0;
        const w = parseFloat((set as WSet).weight) || 0;
        return ss + r * w;
      }, 0), 0)
    );

    const history = await getHistory();
    const newPRs: string[] = [];
    for (const ex of allSaved) {
      const maxNew = Math.max(...ex.sets.map(s => parseFloat((s as WSet).weight) || 0));
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

  const filtered = allExercises.filter(e => matchesExercise(e.name, exSearch, t));

  // Creating an exercise reuses the search box instead of a second field at
  // the bottom of the sheet: the search is autofocused, so the keyboard is
  // always up here and anything below the list is covered by it.
  const searchTerm = exSearch.trim();
  const canCreate = searchTerm.length > 0 && !allExercises.some(e =>
    e.name.toLowerCase() === searchTerm.toLowerCase() ||
    exerciseLabel(e.name, t).toLowerCase() === searchTerm.toLowerCase()
  );

  // ── No active workout ────────────────────────────────────
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

  // ── Active workout ───────────────────────────────────────
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

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        // Set fields further down would otherwise disappear behind the keyboard
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.workoutTitleRow}>
          <Text style={styles.sectionTitle}>{t('workout').toUpperCase()}</Text>
          {exercises.length > 1 && (
            <TouchableOpacity
              style={styles.foldAllBtn}
              onPress={() => setAllCollapsed(!exercises.every(e => e.collapsed))}
            >
              <Text style={styles.foldAllTxt}>
                {exercises.every(e => e.collapsed) ? t('expandAll') : t('collapseAll')}
              </Text>
            </TouchableOpacity>
          )}
          <Text style={styles.dateText}>
            {new Date(activeWorkout.date).toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'long' })}
          </Text>
        </View>

        {exercises.length === 0 && <Text style={styles.emptyState}>{t('noExercises')}</Text>}

        {exercises.map((ex, exIndex) => {
          const last = lastSessions[ex.name];
          const disabled = ex.isCompleted;
          const folded = ex.collapsed;

          return (
            <View key={ex.name} style={[styles.exerciseCard, disabled && styles.exerciseCardDone]}>
              {/* Exercise header */}
              <View style={styles.exHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.exTitleRow}>
                    <Text style={styles.exPos}>{exIndex + 1}.</Text>
                    <TouchableOpacity
                      style={styles.exNameBtn}
                      onPress={() => toggleCollapsed(ex.name)}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                      <Text style={styles.exName} numberOfLines={1}>{exerciseLabel(ex.name, t)}</Text>
                    </TouchableOpacity>
                    <Text style={styles.exChevron}>{folded ? '▾' : '▴'}</Text>
                    <TouchableOpacity
                      style={[styles.moveBtn, exIndex === 0 && styles.moveBtnOff]}
                      onPress={() => moveExercise(exIndex, -1)}
                      disabled={exIndex === 0}
                      hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
                    >
                      <Text style={styles.moveBtnTxt}>↑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.moveBtn, exIndex === exercises.length - 1 && styles.moveBtnOff]}
                      onPress={() => moveExercise(exIndex, 1)}
                      disabled={exIndex === exercises.length - 1}
                      hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
                    >
                      <Text style={styles.moveBtnTxt}>↓</Text>
                    </TouchableOpacity>
                  </View>

                  {folded && (
                    <Text style={styles.exSummary}>{collapsedSummary(ex)}</Text>
                  )}

                  {/* Rest time badge + inline picker */}
                  {!disabled && !folded && (
                    <View style={styles.restTimeRow}>
                      <TouchableOpacity
                        style={[styles.restTimeBadge, ex.restTime !== null && styles.restTimeBadgeCustom]}
                        onPress={() => toggleRestPicker(ex.name)}
                      >
                        <Text style={styles.restTimeBadgeTxt}>
                          ⏱ {ex.restTime ?? restDuration}s
                          {ex.restTime === null ? ' (global)' : ''}
                        </Text>
                      </TouchableOpacity>

                      {ex.showRestPicker && (
                        <View style={styles.restPickerRow}>
                          <TouchableOpacity style={styles.restPickerBtn} onPress={() => changeExRestTime(ex.name, -15)}>
                            <Text style={styles.restPickerBtnTxt}>−</Text>
                          </TouchableOpacity>
                          <Text style={styles.restPickerVal}>{ex.restTime ?? restDuration}s</Text>
                          <TouchableOpacity style={styles.restPickerBtn} onPress={() => changeExRestTime(ex.name, 15)}>
                            <Text style={styles.restPickerBtnTxt}>+</Text>
                          </TouchableOpacity>
                          {ex.restTime !== null && (
                            <TouchableOpacity style={styles.restPickerReset} onPress={() => resetExRestTime(ex.name)}>
                              <Text style={styles.restPickerResetTxt}>↺ Global</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Tracking type pills + L/R toggle */}
                  {!disabled && !folded && (
                    <View style={styles.trackingRow}>
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
                      {/* L/R toggle */}
                      <TouchableOpacity
                        style={[styles.sideToggleBtn, ex.hasSides && styles.sideToggleBtnActive]}
                        onPress={() => toggleHasSides(ex.name)}
                      >
                        <Text style={[styles.sideToggleTxt, ex.hasSides && styles.sideToggleTxtActive]}>L|R</Text>
                      </TouchableOpacity>
                      {/* Extra measurements this machine reports */}
                      <TouchableOpacity
                        style={[styles.sideToggleBtn, ex.extraFields.length > 0 && styles.sideToggleBtnActive]}
                        onPress={() => setFieldsFor(ex.name)}
                      >
                        <Text style={[styles.sideToggleTxt, ex.extraFields.length > 0 && styles.sideToggleTxtActive]}>
                          + {ex.extraFields.length || ''}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <View style={styles.exHeaderRight}>
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
              {!folded && (last ? (
                <View style={styles.lastSession}>
                  <Text style={styles.lastLabel}>
                    {t('lastSession')} · {new Date(last.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                  </Text>
                  <View style={styles.lastChips}>
                    {last.sets.map((s, i) => {
                      // One formatter for the whole app, so percent keeps
                      // reading its value off the load axis everywhere — and
                      // last week's watts show up next to last week's kilos
                      const label = `S${i + 1}: ${formatSetWithExtras(
                        { reps: s.reps, weight: s.weight, side: s.side ?? null, extras: s.extras ?? {} },
                        ex.trackingType,
                        ex.extraFields,
                      )}`;
                      return (
                        <View key={i} style={styles.lastChip}>
                          <Text style={styles.lastChipText}>{label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : (
                <Text style={styles.noHistory}>{t('firstTime')}</Text>
              ))}

              {/* Sets */}
              {!disabled && !folded && (
                <View style={styles.setsBody}>
                  {ex.sets.map((s, idx) => {
                    const hint = ex.trackingType === 'weight_reps'
                      ? repsHintFor(ex.name, s.weight)
                      : null;
                    const elapsed = s.timerRunning && s.timerStartedAt
                      ? Math.floor((Date.now() - s.timerStartedAt) / 1000)
                      : null;

                    return (
                      <React.Fragment key={idx}>
                      <View style={styles.setRow}>
                        <Text style={styles.setNum}>{idx + 1}</Text>

                        {/* L/R side badge */}
                        {ex.hasSides && (
                          <TouchableOpacity
                            style={[styles.sideBadge, s.side === 'left' ? styles.sideBadgeLeft : styles.sideBadgeRight]}
                            onPress={() => toggleSetSide(ex.name, idx)}
                          >
                            <Text style={styles.sideBadgeTxt}>
                              {s.side === 'left' ? t('leftSide' as any) : t('rightSide' as any)}
                            </Text>
                          </TouchableOpacity>
                        )}

                        {/* Inputs per tracking type */}
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
                              {hint && (
                                <View style={styles.hintWrap}>
                                  <Text style={[styles.repsHint, !hint.contextMatched && styles.repsHintLoose]}>
                                    ~{hint.reps} {t('reps')}
                                  </Text>
                                  <Text style={styles.hintSource} numberOfLines={1}>
                                    {hint.contextMatched
                                      ? (hint.preceding.length === 0
                                          ? t('hintFresh', { count: hint.sessions })
                                          : t('hintAfter', { list: hint.preceding.join(' + '), count: hint.sessions }))
                                      : t('hintLastSession', {
                                          date: hint.sourceDate
                                            ? new Date(hint.sourceDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
                                            : '',
                                        })}
                                  </Text>
                                  {/* Once per exercise, not once per set: the
                                      line is the same on every row and only
                                      makes the card harder to read repeated */}
                                  {idx === 0 && (
                                    <Text style={styles.hintTargets} numberOfLines={1}>
                                      {REP_TARGETS
                                        .map(r => t('hintTarget', {
                                          reps: r,
                                          weight: weightForReps(hint.reference, r),
                                        }))
                                        .join('  ·  ')}
                                    </Text>
                                  )}
                                </View>
                              )}
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
                          <View style={styles.timeInputWrap}>
                            {s.timerRunning ? (
                              <>
                                <View style={styles.timerLiveDisplay}>
                                  <Text style={styles.timerLiveText}>{formatDuration(String(elapsed ?? 0))}</Text>
                                </View>
                                <TouchableOpacity style={styles.timerStopBtn} onPress={() => stopSetTimer(ex.name, idx)}>
                                  <Text style={styles.timerBtnTxt}>{t('timerStop' as any)}</Text>
                                </TouchableOpacity>
                              </>
                            ) : (
                              <>
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
                                {!s.isDone && (
                                  <TouchableOpacity style={styles.timerStartBtn} onPress={() => startSetTimer(ex.name, idx)}>
                                    <Text style={styles.timerBtnTxt}>{t('timerStart' as any)}</Text>
                                  </TouchableOpacity>
                                )}
                              </>
                            )}
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

                        {ex.trackingType === 'percent' && (
                          <>
                            <View style={styles.percentRow}>
                              <TextInput
                                style={[styles.setInput, styles.setInputPercent, s.isDone && styles.setInputDone]}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor={colors.muted}
                                value={s.weight}
                                onChangeText={v => updateSet(ex.name, idx, 'weight', v.replace(/[^0-9]/g, '').slice(0, 3))}
                                editable={!s.isDone}
                                maxLength={3}
                              />
                              <Text style={[styles.percentSymbol, s.isDone && { color: colors.accent }]}>%</Text>
                            </View>
                            <TextInput
                              style={[styles.setInput, s.isDone && styles.setInputDone]}
                              keyboardType="numeric"
                              placeholder={t('reps')}
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

                      {/* Whatever else this exercise measures, on its own line
                          so the set row stays readable however many there are */}
                      {ex.extraFields.length > 0 && (
                        <View style={styles.extrasRow}>
                          {ex.extraFields.map(field => (
                            <View key={field.id} style={styles.extraItem}>
                              <Text style={styles.extraLabel} numberOfLines={1}>
                                {field.label}{field.unit ? ` (${field.unit})` : ''}
                              </Text>
                              <TextInput
                                style={[styles.extraInput, s.isDone && styles.setInputDone]}
                                keyboardType="numeric"
                                placeholder="—"
                                placeholderTextColor={colors.muted}
                                value={s.extras?.[field.id] ?? ''}
                                onChangeText={v => updateExtra(ex.name, idx, field.id, v)}
                                editable={!s.isDone}
                              />
                            </View>
                          ))}
                        </View>
                      )}
                    </React.Fragment>
                    );
                  })}
                  <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(ex.name)}>
                    <Text style={styles.addSetText}>
                      {ex.hasSides ? t('addPair' as any) : t('addSet')}
                    </Text>
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
                returnKeyType="done"
                onSubmitEditing={() => { if (canCreate) handleCreateAndAdd(exSearch); }}
              />
            </View>

            <FlatList
              data={filtered}
              keyExtractor={item => item.name}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              automaticallyAdjustKeyboardInsets
              contentContainerStyle={{ paddingHorizontal: 16 }}
              ListHeaderComponent={canCreate ? (
                <TouchableOpacity
                  style={styles.createExItem}
                  onPress={() => handleCreateAndAdd(exSearch)}
                >
                  <Text style={styles.createExText}>
                    {t('createExercise', { name: exSearch.trim() })}
                  </Text>
                </TouchableOpacity>
              ) : null}
              renderItem={({ item }: { item: typeof allExercises[0] }) => {
                const added = exercises.find(e => e.name === item.name);
                return (
                  <TouchableOpacity style={styles.exListItem} onPress={() => handleAddExercise(item.name)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.exListText}>{exerciseLabel(item.name, t)}</Text>
                      {item.isCustom && <Text style={styles.customTag}>{t('custom')}</Text>}
                    </View>
                    {added && <Text style={styles.addedCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />

          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Extra measurements for one exercise */}
      <Modal visible={!!fieldsFor} transparent animationType="fade" onRequestClose={() => setFieldsFor(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('extraFieldsTitle')}</Text>
            <Text style={styles.modalSub}>{fieldsFor && exerciseLabel(fieldsFor, t)}</Text>
            <Text style={styles.modalHint}>{t('extraFieldsHint')}</Text>

            {(() => {
              const ex = exercises.find(e => e.name === fieldsFor);
              if (!ex || ex.extraFields.length === 0) {
                return <Text style={styles.modalEmpty}>{t('extraFieldsNone')}</Text>;
              }
              return (
                <View style={styles.fieldList}>
                  {ex.extraFields.map(f => (
                    <View key={f.id} style={styles.fieldRow}>
                      <Text style={styles.fieldName}>
                        {f.label}{f.unit ? ` (${f.unit})` : ''}
                      </Text>
                      <TouchableOpacity onPress={() => removeExtraField(ex.name, f.id)}>
                        <Text style={styles.fieldRemove}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              );
            })()}

            <View style={styles.fieldInputs}>
              <TextInput
                style={[styles.textInput, { flex: 2 }]}
                placeholder={t('extraFieldName')}
                placeholderTextColor={colors.muted}
                value={newFieldLabel}
                onChangeText={setNewFieldLabel}
              />
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                placeholder={t('extraFieldUnit')}
                placeholderTextColor={colors.muted}
                value={newFieldUnit}
                onChangeText={setNewFieldUnit}
                onSubmitEditing={() => fieldsFor && addExtraField(fieldsFor)}
              />
              <TouchableOpacity
                style={[styles.addNewExBtn, !newFieldLabel.trim() && { opacity: 0.35 }]}
                onPress={() => fieldsFor && addExtraField(fieldsFor)}
                disabled={!newFieldLabel.trim()}
              >
                <Text style={styles.addNewExText}>+</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.modalDone} onPress={() => setFieldsFor(null)}>
              <Text style={styles.modalDoneTxt}>{t('save')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
    foldAllBtn: {
      paddingHorizontal: 10, paddingVertical: 3,
      borderRadius: 12, borderWidth: 1,
      borderColor: c.border, backgroundColor: c.surface2,
    },
    foldAllTxt: { fontSize: 10, color: c.muted },
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
    exTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    exPos: { fontFamily: 'BebasNeue_400Regular', fontSize: 17, color: c.accent, minWidth: 18 },
    exNameBtn: { flex: 1 },
    exName: { fontWeight: '600', fontSize: 16, color: c.text },
    exChevron: { fontSize: 11, color: c.muted, paddingHorizontal: 2 },
    exSummary: { fontSize: 12, color: c.muted, marginLeft: 24, marginBottom: 2 },
    moveBtn: {
      width: 26, height: 26, borderRadius: 6,
      borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2,
      alignItems: 'center', justifyContent: 'center',
    },
    moveBtnOff: { opacity: 0.3 },
    moveBtnTxt: { color: c.accent, fontSize: 13, fontWeight: '700' },
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

    // Rest time per exercise
    restTimeRow: { marginBottom: 6 },
    restTimeBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10, paddingVertical: 3,
      borderRadius: 12, borderWidth: 1,
      borderColor: c.border, backgroundColor: c.surface2,
    },
    restTimeBadgeCustom: { borderColor: c.accent, backgroundColor: c.accentBg },
    restTimeBadgeTxt: { fontSize: 11, color: c.muted },
    restPickerRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      marginTop: 6,
    },
    restPickerBtn: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    restPickerBtnTxt: { color: c.accent, fontSize: 18, fontWeight: '700' },
    restPickerVal: { fontFamily: 'BebasNeue_400Regular', fontSize: 22, color: c.text, minWidth: 44, textAlign: 'center' },
    restPickerReset: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: c.border },
    restPickerResetTxt: { fontSize: 11, color: c.muted },

    trackingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    trackingPills: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
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

    // L|R toggle button
    sideToggleBtn: {
      paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: 12, borderWidth: 1,
      borderColor: c.border, backgroundColor: c.surface2,
      alignSelf: 'flex-start',
    },
    sideToggleBtnActive: { borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.15)' },
    sideToggleTxt: { fontSize: 10, color: c.muted, fontWeight: '700' },
    sideToggleTxtActive: { color: '#3b82f6' },

    // Side badge on set rows
    sideBadge: {
      width: 28, height: 38,
      borderRadius: 6, borderWidth: 1,
      alignItems: 'center', justifyContent: 'center',
    },
    sideBadgeLeft: { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: '#3b82f6' },
    sideBadgeRight: { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: '#ef4444' },
    sideBadgeTxt: { fontSize: 13, fontWeight: '800', color: c.text },

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
    setInputPercent: { width: 58 },
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
    repsHintLoose: { opacity: 0.6 },

    extrasRow: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 8,
      marginLeft: 32, marginTop: -2, marginBottom: 8,
    },
    extraItem: { alignItems: 'flex-start' },
    extraLabel: { fontSize: 9, color: c.muted, marginBottom: 2, maxWidth: 90 },
    extraInput: {
      width: 82,
      backgroundColor: c.surface2,
      borderWidth: 1, borderColor: c.border,
      color: c.text,
      paddingVertical: 6, paddingHorizontal: 6,
      borderRadius: 6, fontSize: 14, textAlign: 'center',
    },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 22 },
    modalCard: { backgroundColor: c.surface, borderRadius: 14, padding: 18, gap: 10 },
    modalTitle: { fontFamily: 'BebasNeue_400Regular', fontSize: 20, letterSpacing: 2, color: c.text },
    modalSub: { fontSize: 13, color: c.accent, marginTop: -6 },
    modalHint: { fontSize: 11, color: c.muted, lineHeight: 16 },
    modalEmpty: { fontSize: 12, color: c.muted, fontStyle: 'italic' },
    fieldList: { gap: 6 },
    fieldRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border,
      borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9,
    },
    fieldName: { fontSize: 14, color: c.text, flex: 1 },
    fieldRemove: { fontSize: 14, color: c.muted, paddingHorizontal: 4 },
    fieldInputs: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
    modalDone: {
      backgroundColor: c.accent, borderRadius: 8,
      paddingVertical: 12, alignItems: 'center', marginTop: 4,
    },
    modalDoneTxt: { color: '#000', fontSize: 15, fontWeight: '700' },
    hintWrap: { alignItems: 'center', maxWidth: 96 },
    hintSource: { fontSize: 8, color: c.muted, marginTop: 1, textAlign: 'center' },
    hintTargets: { fontSize: 8, color: c.muted, opacity: 0.85, marginTop: 1, textAlign: 'center' },
    checkBtn: { width: 38, height: 38, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    checkBtnDone: { backgroundColor: c.accent, borderColor: c.accent },
    checkBtnText: { color: c.muted, fontSize: 16, fontWeight: '700' },
    delBtn: { color: c.muted, fontSize: 22, width: 34, height: 38, textAlign: 'center', lineHeight: 38 },
    addSetBtn: { borderWidth: 1, borderColor: c.border, borderStyle: 'dashed', borderRadius: 6, padding: 10, alignItems: 'center', marginTop: 4 },
    addSetText: { color: c.muted, fontSize: 13 },

    // Time tracking: set-level timer
    timeInputWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    timerLiveDisplay: {
      width: 110, height: 38,
      backgroundColor: 'rgba(59,130,246,0.12)',
      borderWidth: 1, borderColor: '#3b82f6',
      borderRadius: 6, alignItems: 'center', justifyContent: 'center',
    },
    timerLiveText: { fontFamily: 'BebasNeue_400Regular', fontSize: 22, color: '#3b82f6', letterSpacing: 1 },
    timerStartBtn: {
      width: 38, height: 38,
      backgroundColor: 'rgba(59,130,246,0.12)',
      borderWidth: 1, borderColor: '#3b82f6',
      borderRadius: 6, alignItems: 'center', justifyContent: 'center',
    },
    timerStopBtn: {
      width: 38, height: 38,
      backgroundColor: 'rgba(239,68,68,0.12)',
      borderWidth: 1, borderColor: '#ef4444',
      borderRadius: 6, alignItems: 'center', justifyContent: 'center',
    },
    timerBtnTxt: { fontSize: 16 },

    // Percent tracking
    percentRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    percentSymbol: { fontSize: 20, fontWeight: '700', color: c.muted },

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
    createExItem: {
      paddingVertical: 13, paddingHorizontal: 4,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    createExText: { fontSize: 15, color: c.accent, fontWeight: '600' },
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
