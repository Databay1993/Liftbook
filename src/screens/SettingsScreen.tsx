import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { themes, ThemeId, Colors } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { LANGUAGES, changeLanguage } from '../i18n';
import { exportAllData } from '../storage/database';
import Toast from '../components/Toast';

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

  useEffect(() => {
    AsyncStorage.getItem(REST_KEY).then(v => {
      if (v) setRestDuration(Number(v));
    });
  }, []);

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

        {/* ── About ── */}
        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>{t('about').toUpperCase()}</Text>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutAppName}>Liftbook</Text>
          <Text style={styles.aboutVersion}>{t('version')} 1.0.0</Text>
          <Text style={styles.aboutDesc}>
            Minimal workout tracker. Log lifts, track PRs, see progress.
          </Text>
        </View>
      </ScrollView>

      {toast && <Toast message={toast} />}
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
    aboutVersion: { fontSize: 12, color: c.muted },
    aboutDesc: { fontSize: 14, color: c.muted, marginTop: 8, lineHeight: 20 },
  });
}
