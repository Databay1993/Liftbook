import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { themes, ThemeId, Colors } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { LANGUAGES, changeLanguage } from '../i18n';
import {
  exportAllData, getAllExercises, renameExercise,
  updateExerciseMuscleGroup, MUSCLE_GROUPS,
  getExerciseUsage, deleteExerciseCompletely,
} from '../storage/database';
import { APP_VERSION, BUILD_NUMBER, COMMIT, BUILT_AT } from '../generated/version';
import { loadSetRule, saveSetRule } from '../lib/setRule';
import type { SetRule } from '../lib/analytics';
import Toast from '../components/Toast';
import { exerciseLabel } from '../lib/exerciseName';

const REST_KEY = '@liftbook_rest';
const MIN_REST = 10;
const MAX_REST = 600;
const STEP = 5;

const THEME_LIST: { id: ThemeId; nameKey: string }[] = [
  { id: 'dark',   nameKey: 'themeDark'   },
  { id: 'energy', nameKey: 'themeEnergy' },
  { id: 'chalk',  nameKey: 'themeChalk'  },
];

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, themeId, setTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [toast, setToast] = useState<string | null>(null);
  const [restDuration, setRestDuration] = useState(90);
  const [exercises, setExercises] = useState<{ name: string; isCustom: boolean; muscleGroup: string | null }[]>([]);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [groupTarget, setGroupTarget] = useState<string | null>(null);
  const [setRule, setSetRule] = useState<SetRule>('first');
  // Folded on every visit, not remembered: the list is long enough to bury
  // everything under it, and it is only ever opened to change one entry
  const [showExercises, setShowExercises] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(REST_KEY).then(v => {
      if (v) setRestDuration(Number(v));
    });
    loadExercises();
    loadSetRule().then(setSetRule);
  }, []);

  async function changeSetRule(rule: SetRule) {
    setSetRule(rule);
    await saveSetRule(rule);
  }

  async function loadExercises() {
    const all = await getAllExercises();
    setExercises(all.map(e => ({ name: e.name, isCustom: e.isCustom, muscleGroup: e.muscleGroup })));
  }

  /**
   * Deleting takes the logged sets with it, so the confirmation names exactly
   * what is about to be lost rather than asking a generic "are you sure".
   */
  async function confirmDelete(name: string) {
    const usage = await getExerciseUsage(name);
    const details = usage.sets === 0
      ? t('deleteExerciseUnused')
      : t('deleteExerciseUsage', {
          sets: usage.sets,
          workouts: usage.workouts,
          templates: usage.templates,
        });

    Alert.alert(
      t('deleteExerciseTitle', { name }),
      details,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteExerciseCompletely(name);
            await loadExercises();
            showToast(t('deleteExerciseDone'));
          },
        },
      ],
    );
  }

  /** Groups are multi-select: a squat tires quads and glutes alike. */
  async function toggleGroup(name: string, group: string) {
    const current = exercises.find(e => e.name === name)?.muscleGroup ?? null;
    const set = new Set(current ? current.split(',').filter(Boolean) : []);
    if (set.has(group)) set.delete(group);
    else set.add(group);

    const next = [...set].join(',') || null;
    await updateExerciseMuscleGroup(name, next);
    await loadExercises();
  }

  async function clearGroups(name: string) {
    await updateExerciseMuscleGroup(name, null);
    await loadExercises();
    setGroupTarget(null);
  }

  function openRename(name: string) {
    setRenameTarget(name);
    setRenameInput(name);
  }

  async function handleRename() {
    const newName = renameInput.trim();
    if (!newName || !renameTarget) return;
    if (newName === renameTarget) { setRenameTarget(null); return; }
    try {
      await renameExercise(renameTarget, newName);
      await loadExercises();
      setRenameTarget(null);
      showToast(t('renameSuccess' as any));
    } catch {
      showToast(t('renameError' as any));
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  async function changeRest(delta: number) {
    const next = Math.min(MAX_REST, Math.max(MIN_REST, restDuration + delta));
    setRestDuration(next);
    await AsyncStorage.setItem(REST_KEY, String(next));
  }

  async function handleExport() {
    try {
      const json = await exportAllData();
      const path =
        FileSystem.documentDirectory +
        `liftbook-backup-${new Date().toISOString().slice(0, 10)}.json`;
      await FileSystem.writeAsStringAsync(path, json);
      await Sharing.shareAsync(path, { mimeType: 'application/json' });
      showToast(t('backupSaved'));
    } catch {
      showToast('Export failed ✗');
    }
  }

  function handleImport() {
    Alert.alert(
      t('importData'),
      'Open your liftbook-backup.json from the Files app and share it to Liftbook.',
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.logo}>LIFTBOOK</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={styles.pageTitle}>{t('settings').toUpperCase()}</Text>

        {/* ── Language ── */}
        <Text style={styles.sectionTitle}>{t('language').toUpperCase()}</Text>
        <View style={styles.langList}>
          {LANGUAGES.map(lang => {
            const active = i18n.language === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[styles.langItem, active && styles.langItemActive]}
                onPress={() => changeLanguage(lang.code)}
                activeOpacity={0.75}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <Text style={[styles.langLabel, active && styles.langLabelActive]}>
                  {lang.label}
                </Text>
                {active && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Theme ── */}
        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>{t('theme').toUpperCase()}</Text>
        <View style={styles.themeGrid}>
          {THEME_LIST.map(th => {
            const active = themeId === th.id;
            const def = themes[th.id];
            const c = def.colors;
            return (
              <TouchableOpacity
                key={th.id}
                style={[styles.themeCard, active && styles.themeCardActive]}
                onPress={() => setTheme(th.id)}
                activeOpacity={0.75}
              >
                {/* Mini palette preview */}
                <View style={[styles.themePreview, { backgroundColor: c.bg }]}>
                  <View style={[styles.themePreviewBar, { backgroundColor: c.surface }]}>
                    <View style={[styles.themePreviewAccent, { backgroundColor: c.accent }]} />
                  </View>
                  <View style={[styles.themePreviewRow, { gap: 4 }]}>
                    <View style={[styles.themePreviewChip, { backgroundColor: c.surface2, borderColor: c.border }]} />
                    <View style={[styles.themePreviewChip, { backgroundColor: c.surface2, borderColor: c.border }]} />
                  </View>
                </View>
                <Text style={styles.themeEmoji}>{def.emoji}</Text>
                <Text style={[styles.themeLabel, active && styles.themeLabelActive]}>
                  {t(th.nameKey as any)}
                </Text>
                {active && <Text style={styles.themeCheck}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Rest Timer ── */}
        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>{t('restTimer').toUpperCase()}</Text>
        <View style={styles.restCard}>
          <Text style={styles.restLabel}>{t('restAfterSet')}</Text>
          <View style={styles.restRow}>
            <TouchableOpacity
              style={styles.restBtn}
              onPress={() => changeRest(-STEP)}
              activeOpacity={0.7}
            >
              <Text style={styles.restBtnText}>−</Text>
            </TouchableOpacity>
            <View style={styles.restValueBox}>
              <Text style={styles.restValue}>{restDuration}</Text>
              <Text style={styles.restUnit}>sec</Text>
            </View>
            <TouchableOpacity
              style={styles.restBtn}
              onPress={() => changeRest(STEP)}
              activeOpacity={0.7}
            >
              <Text style={styles.restBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Backup ── */}
        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>{t('backup').toUpperCase()}</Text>
        <View style={styles.backupRow}>
          <TouchableOpacity style={styles.backupBtn} onPress={handleExport}>
            <Text style={styles.backupIcon}>⬇</Text>
            <Text style={styles.backupBtnText}>{t('exportData')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backupBtn} onPress={handleImport}>
            <Text style={styles.backupIcon}>⬆</Text>
            <Text style={styles.backupBtnText}>{t('importData')}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.backupHint}>{t('backupHint')}</Text>

        {/* ── Statistics rule ── */}
        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>{t('setRuleSection').toUpperCase()}</Text>
        <Text style={styles.sectionHint}>{t('setRuleHint')}</Text>
        <View style={styles.exerciseList}>
          {([
            { key: 'first', label: t('setRuleFirst'), desc: t('setRuleFirstDesc') },
            { key: 'best',  label: t('setRuleBest'),  desc: t('setRuleBestDesc')  },
          ] as { key: SetRule; label: string; desc: string }[]).map(option => (
            <TouchableOpacity
              key={option.key}
              style={[styles.ruleRow, setRule === option.key && styles.ruleRowActive]}
              onPress={() => changeSetRule(option.key)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.ruleLabel, setRule === option.key && styles.ruleLabelActive]}>
                  {option.label}
                </Text>
                <Text style={styles.ruleDesc}>{option.desc}</Text>
              </View>
              {setRule === option.key && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Exercises ── */}
        <TouchableOpacity
          style={[styles.sectionHead, { marginTop: 32 }]}
          onPress={() => setShowExercises(v => !v)}
          activeOpacity={0.7}
        >
          <Text style={styles.sectionTitle}>{t('exercisesSection' as any).toUpperCase()}</Text>
          <Text style={styles.sectionCount}>
            {t('exercisesCount' as any, { count: exercises.length })}
          </Text>
          <Text style={styles.sectionChevron}>{showExercises ? '▾' : '▸'}</Text>
        </TouchableOpacity>
        {showExercises && (
        <>
        <Text style={styles.sectionHint}>{t('muscleGroupHint')}</Text>
        <View style={styles.exerciseList}>
          {exercises.map(ex => (
            <View key={ex.name} style={styles.exerciseRow}>
              <Text style={styles.exerciseName} numberOfLines={1}>{exerciseLabel(ex.name, t)}</Text>
              <TouchableOpacity
                style={[styles.groupChip, !ex.muscleGroup && styles.groupChipEmpty]}
                onPress={() => setGroupTarget(ex.name)}
              >
                <Text style={[styles.groupChipTxt, !ex.muscleGroup && styles.groupChipTxtEmpty]}>
                  {ex.muscleGroup
                    ? ex.muscleGroup.split(',').filter(Boolean).map(g => t(`muscle_${g}` as any)).join(' · ')
                    : t('muscleGroupNone')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.renameBtn} onPress={() => openRename(ex.name)}>
                <Text style={styles.renameBtnTxt}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.renameBtn} onPress={() => confirmDelete(ex.name)}>
                <Text style={styles.renameBtnTxt}>🗑</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
        </>
        )}

        {/* ── About ── */}
        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>{t('about').toUpperCase()}</Text>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutAppName}>Liftbook</Text>
          <Text style={styles.aboutVersion}>
            {t('version')} {APP_VERSION} · {t('build')} {BUILD_NUMBER}
          </Text>
          <Text style={styles.aboutBuildMeta}>
            {new Date(BUILT_AT).toLocaleString(undefined, {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })} · {COMMIT}
          </Text>
          <Text style={styles.aboutDesc}>
            Minimal workout tracker. Log lifts, track PRs, see progress.
          </Text>
        </View>
      </ScrollView>

      {toast && <Toast message={toast} />}

      {/* Muscle group picker */}
      <Modal visible={!!groupTarget} transparent animationType="fade" onRequestClose={() => setGroupTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('muscleGroupTitle')}</Text>
            <Text style={styles.modalOldName}>{groupTarget && exerciseLabel(groupTarget, t)}</Text>
            <Text style={styles.modalHint}>{t('muscleGroupMulti')}</Text>
            <View style={styles.groupGrid}>
              {MUSCLE_GROUPS.map(g => {
                const current = exercises.find(e => e.name === groupTarget)?.muscleGroup ?? '';
                const active = current.split(',').includes(g);
                return (
                  <TouchableOpacity
                    key={g}
                    style={[styles.groupOption, active && styles.groupOptionActive]}
                    onPress={() => groupTarget && toggleGroup(groupTarget, g)}
                  >
                    <Text style={[styles.groupOptionTxt, active && styles.groupOptionTxtActive]}>
                      {active ? '✓ ' : ''}{t(`muscle_${g}` as any)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => groupTarget && clearGroups(groupTarget)}
              >
                <Text style={styles.modalCancelTxt}>{t('muscleGroupClear')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={() => setGroupTarget(null)}>
                <Text style={styles.modalSaveTxt}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rename modal */}
      <Modal visible={!!renameTarget} transparent animationType="fade" onRequestClose={() => setRenameTarget(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('renameExercise' as any)}</Text>
            <Text style={styles.modalOldName}>{renameTarget && exerciseLabel(renameTarget, t)}</Text>
            <TextInput
              style={styles.modalInput}
              value={renameInput}
              onChangeText={setRenameInput}
              placeholder={t('newExerciseNamePlaceholder' as any)}
              placeholderTextColor={colors.muted}
              autoFocus
              onSubmitEditing={handleRename}
              returnKeyType="done"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRenameTarget(null)}>
                <Text style={styles.modalCancelTxt}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleRename}>
                <Text style={styles.modalSaveTxt}>{t('save')}</Text>
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
    content: { padding: 16 },
    pageTitle: {
      fontFamily: 'BebasNeue_400Regular',
      fontSize: 18,
      letterSpacing: 2,
      color: c.muted,
      marginBottom: 16,
    },
    sectionTitle: {
      fontFamily: 'BebasNeue_400Regular',
      fontSize: 18,
      letterSpacing: 2,
      color: c.muted,
      marginBottom: 10,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
    },
    sectionCount: { flex: 1, fontSize: 12, color: c.muted, opacity: 0.7 },
    sectionChevron: { fontSize: 14, color: c.muted },

    // Language
    langList: { gap: 8 },
    langItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      padding: 16,
    },
    langItemActive: { borderColor: c.accent, backgroundColor: c.accentBg },
    langFlag: { fontSize: 24 },
    langLabel: { flex: 1, fontSize: 16, color: c.text },
    langLabelActive: { color: c.accent, fontWeight: '600' },
    checkmark: { color: c.accent, fontSize: 18, fontWeight: '700' },

    // Theme picker
    themeGrid: { flexDirection: 'row', gap: 10 },
    themeCard: {
      flex: 1,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
      gap: 6,
    },
    themeCardActive: { borderColor: c.accent, borderWidth: 2 },
    themePreview: {
      width: '100%',
      height: 56,
      borderRadius: 8,
      overflow: 'hidden',
      padding: 6,
      gap: 4,
    },
    themePreviewBar: {
      height: 16,
      borderRadius: 4,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 6,
    },
    themePreviewAccent: { width: 20, height: 8, borderRadius: 4 },
    themePreviewRow: { flexDirection: 'row' },
    themePreviewChip: {
      flex: 1,
      height: 12,
      borderRadius: 3,
      borderWidth: 1,
    },
    themeEmoji: { fontSize: 20 },
    themeLabel: { fontSize: 12, color: c.muted, fontWeight: '500' },
    themeLabelActive: { color: c.accent, fontWeight: '700' },
    themeCheck: { color: c.accent, fontSize: 14, fontWeight: '700' },

    // Rest Timer
    restCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      padding: 16,
      gap: 14,
    },
    restLabel: { fontSize: 14, color: c.muted },
    restRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
    restBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    restBtnText: { color: c.accent, fontSize: 24, fontWeight: '700', lineHeight: 28 },
    restValueBox: { alignItems: 'center', minWidth: 70 },
    restValue: { fontFamily: 'BebasNeue_400Regular', fontSize: 42, color: c.text, lineHeight: 46 },
    restUnit: { fontSize: 12, color: c.muted, marginTop: -4 },

    // Backup
    backupRow: { flexDirection: 'row', gap: 10 },
    backupBtn: {
      flex: 1,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      padding: 16,
      alignItems: 'center',
      gap: 6,
    },
    backupIcon: { fontSize: 22 },
    backupBtnText: { color: c.text, fontSize: 14 },
    backupHint: { fontSize: 11, color: c.muted, textAlign: 'center', marginTop: 10 },

    // Exercise list
    exerciseList: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      overflow: 'hidden',
    },
    exerciseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    exerciseName: { flex: 1, fontSize: 15, color: c.text },
    renameBtn: { padding: 4, marginLeft: 6 },
    renameBtnTxt: { fontSize: 16 },
    sectionHint: { fontSize: 11, color: c.muted, lineHeight: 16, marginBottom: 8 },
    ruleRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    ruleRowActive: { backgroundColor: c.accentBg },
    ruleLabel: { fontSize: 15, color: c.text },
    ruleLabelActive: { color: c.accent, fontWeight: '700' },
    ruleDesc: { fontSize: 11, color: c.muted, marginTop: 2, lineHeight: 15 },

    groupChip: {
      maxWidth: 150,
      paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: 12, borderWidth: 1,
      borderColor: c.accentBorder, backgroundColor: c.accentBg,
    },
    modalHint: { fontSize: 11, color: c.muted, lineHeight: 16 },
    groupChipEmpty: { borderColor: c.border, backgroundColor: c.surface2, borderStyle: 'dashed' },
    groupChipTxt: { fontSize: 11, color: c.accent, fontWeight: '600' },
    groupChipTxtEmpty: { color: c.muted, fontWeight: '400' },

    groupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 4 },
    groupOption: {
      paddingHorizontal: 14, paddingVertical: 9,
      borderRadius: 8, borderWidth: 1,
      borderColor: c.border, backgroundColor: c.surface2,
    },
    groupOptionActive: { borderColor: c.accent, backgroundColor: c.accentBg },
    groupOptionTxt: { fontSize: 13, color: c.text },
    groupOptionTxtActive: { color: c.accent, fontWeight: '700' },

    // Rename modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      padding: 24,
    },
    modalCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 20,
      gap: 12,
    },
    modalTitle: {
      fontFamily: 'BebasNeue_400Regular',
      fontSize: 20,
      letterSpacing: 2,
      color: c.text,
    },
    modalOldName: { fontSize: 13, color: c.muted },
    modalInput: {
      backgroundColor: c.surface2,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontSize: 16,
      color: c.text,
    },
    modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
    modalCancelBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
    },
    modalCancelTxt: { color: c.muted, fontSize: 15 },
    modalSaveBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: c.accent,
      alignItems: 'center',
    },
    modalSaveTxt: { color: '#000', fontSize: 15, fontWeight: '700' },

    // About
    aboutCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      padding: 16,
      gap: 4,
    },
    aboutAppName: { fontFamily: 'BebasNeue_400Regular', fontSize: 22, letterSpacing: 2, color: c.text },
    aboutVersion: { fontSize: 12, color: c.accent, fontWeight: '600' },
    aboutBuildMeta: { fontSize: 11, color: c.muted },
    aboutDesc: { fontSize: 14, color: c.muted, marginTop: 8, lineHeight: 20 },
  });
}
