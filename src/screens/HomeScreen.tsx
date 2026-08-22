import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Colors } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useWorkout } from '../context/WorkoutContext';
import {
  getHistory, addCustomExercise,
  getTemplates, deleteTemplate, getLastWorkoutDate, Template,
} from '../storage/database';
import Toast from '../components/Toast';
import TemplateEditorScreen from './TemplateEditorScreen';

export default function HomeScreen({ navigation }: any) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { activeWorkout, startWorkout } = useWorkout();

  const [stats, setStats] = useState({ workouts: 0, exercises: 0, sets: 0 });
  const [customExInput, setCustomExInput] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [lastTrainedLabel, setLastTrainedLabel] = useState<string | null>(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  useFocusEffect(useCallback(() => {
    loadAll();
  }, []));

  async function loadAll() {
    const [history, tmpl, lastDate] = await Promise.all([
      getHistory(), getTemplates(), getLastWorkoutDate(),
    ]);
    const workoutIds = new Set(history.map(r => r.workoutId));
    const exerciseNames = new Set(history.map(r => r.exerciseName));
    setStats({ workouts: workoutIds.size, exercises: exerciseNames.size, sets: history.length });
    setTemplates(tmpl);
    setLastTrainedLabel(formatLastTrained(lastDate));
  }

  function formatLastTrained(date: string | null): string | null {
    if (!date) return null;
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
    if (diff === 0) return t('today');
    if (diff === 1) return t('yesterday');
    return `${diff} ${t('daysAgo')}`;
  }

  function handleStartFromTemplate(tmpl: Template) {
    startWorkout(tmpl.exercises);
    navigation.navigate('WorkoutTab');
  }

  function handleDeleteTemplate(id: number) {
    Alert.alert(t('deleteTemplate'), '', [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => {
        await deleteTemplate(id);
        loadAll();
      }},
    ]);
  }

  async function handleAddCustomExercise() {
    const name = customExInput.trim();
    if (!name) return;
    try {
      await addCustomExercise(name);
      setCustomExInput('');
      showToast(t('exerciseAdded'));
    } catch {
      showToast(t('exerciseExists'));
    }
  }

  function handleStartWorkout() {
    startWorkout();
    navigation.navigate('WorkoutTab');
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>LIFTBOOK</Text>
      </View>

      {/* Active workout banner */}
      {activeWorkout && (
        <TouchableOpacity style={styles.banner} onPress={() => navigation.navigate('WorkoutTab')}>
          <Text style={styles.bannerText}>{t('workoutRunning')}</Text>
          <Text style={styles.bannerBtn}>{t('goBack')}</Text>
        </TouchableOpacity>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 90 }]}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{t('readyToPush')}</Text>
          <Text style={styles.heroSub}>{t('heroSub')}</Text>
          {lastTrainedLabel && (
            <View style={styles.lastTrainedBadge}>
              <Text style={styles.lastTrainedText}>🕐 {t('lastTrained')}: {lastTrainedLabel}</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: t('workouts'), value: stats.workouts },
            { label: t('exercises'), value: stats.exercises },
            { label: t('sets'), value: stats.sets },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statNum}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Start blank workout */}
        <TouchableOpacity style={styles.btnPrimary} onPress={handleStartWorkout}>
          <Text style={styles.btnPrimaryText}>{t('startWorkout')}</Text>
        </TouchableOpacity>

        {/* Workout Plans / Templates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('templates').toUpperCase()}</Text>
          {templates.length === 0 ? (
            <Text style={styles.emptyHint}>{t('noTemplates')}</Text>
          ) : (
            templates.map(tmpl => (
              <View key={tmpl.id} style={styles.templateCard}>
                <View style={styles.templateInfo}>
                  <Text style={styles.templateName}>{tmpl.name}</Text>
                  <Text style={styles.templateExercises}>
                    {tmpl.exercises.slice(0, 3).join(' · ')}
                    {tmpl.exercises.length > 3 ? ` +${tmpl.exercises.length - 3}` : ''}
                  </Text>
                </View>
                <View style={styles.templateBtns}>
                  <TouchableOpacity
                    style={styles.startTemplateBtn}
                    onPress={() => handleStartFromTemplate(tmpl)}
                  >
                    <Text style={styles.startTemplateBtnText}>{t('startFromTemplate')} →</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setEditTemplate(tmpl); setShowTemplateEditor(true); }}>
                    <Text style={styles.deleteTemplateBtn}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteTemplate(tmpl.id)}>
                    <Text style={styles.deleteTemplateBtn}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
          <TouchableOpacity style={styles.newTemplateBtn} onPress={() => setShowTemplateEditor(true)}>
            <Text style={styles.newTemplateBtnText}>{t('newTemplate')}</Text>
          </TouchableOpacity>
        </View>

        {/* Custom exercise */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('addCustomExercise').toUpperCase()}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder={t('exerciseName')}
              placeholderTextColor={colors.muted}
              value={customExInput}
              onChangeText={setCustomExInput}
              onSubmitEditing={handleAddCustomExercise}
            />
            <TouchableOpacity style={styles.btnSecondary} onPress={handleAddCustomExercise}>
              <Text style={styles.btnSecondaryText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      {toast && <Toast message={toast} />}

      <TemplateEditorScreen
        visible={showTemplateEditor}
        template={editTemplate}
        onClose={() => { setShowTemplateEditor(false); setEditTemplate(null); }}
        onSaved={() => { loadAll(); showToast(t('saved')); }}
      />
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    logo: { fontFamily: 'BebasNeue_400Regular', fontSize: 26, letterSpacing: 3, color: c.accent },
    banner: {
      backgroundColor: c.accent,
      paddingHorizontal: 16,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    bannerText: { color: '#000', fontWeight: '600', fontSize: 14 },
    bannerBtn: { color: '#000', fontWeight: '700', fontSize: 13 },
    scroll: { flex: 1 },
    content: { padding: 16 },
    hero: { alignItems: 'center', paddingVertical: 28 },
    heroTitle: {
      fontFamily: 'BebasNeue_400Regular',
      fontSize: 48,
      letterSpacing: 3,
      color: c.text,
      textAlign: 'center',
      lineHeight: 52,
    },
    heroSub: { color: c.muted, marginTop: 6, fontSize: 13 },
    statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    statCard: {
      flex: 1,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      padding: 14,
      alignItems: 'center',
    },
    statNum: { fontFamily: 'BebasNeue_400Regular', fontSize: 30, color: c.accent },
    statLabel: { fontSize: 10, color: c.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
    btnPrimary: {
      backgroundColor: c.accent,
      paddingVertical: 15,
      borderRadius: 8,
      alignItems: 'center',
      marginBottom: 4,
    },
    btnPrimaryText: { fontFamily: 'BebasNeue_400Regular', fontSize: 20, letterSpacing: 2, color: '#000' },
    section: { marginTop: 24 },
    sectionTitle: {
      fontFamily: 'BebasNeue_400Regular',
      fontSize: 18,
      letterSpacing: 2,
      color: c.muted,
      marginBottom: 10,
    },
    inputRow: { flexDirection: 'row', gap: 8 },
    textInput: {
      flex: 1,
      backgroundColor: c.surface2,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 6,
      fontSize: 15,
    },
    btnSecondary: {
      backgroundColor: c.surface2,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 18,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnSecondaryText: { color: c.text, fontSize: 20 },
    lastTrainedBadge: {
      marginTop: 10,
      backgroundColor: c.surface2,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 5,
    },
    lastTrainedText: { color: c.muted, fontSize: 12 },
    emptyHint: { color: c.muted, fontSize: 13, marginBottom: 12, lineHeight: 20 },
    templateCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      padding: 14,
      marginBottom: 10,
    },
    templateInfo: { marginBottom: 10 },
    templateName: { fontWeight: '700', fontSize: 16, color: c.text, marginBottom: 4 },
    templateExercises: { fontSize: 12, color: c.muted },
    templateBtns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    startTemplateBtn: {
      backgroundColor: c.accent,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    startTemplateBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
    deleteTemplateBtn: { fontSize: 18, padding: 4 },
    newTemplateBtn: {
      borderWidth: 1,
      borderColor: c.accent,
      borderStyle: 'dashed',
      borderRadius: 8,
      padding: 13,
      alignItems: 'center',
      marginTop: 4,
    },
    newTemplateBtnText: { color: c.accent, fontSize: 14 },
  });
}
