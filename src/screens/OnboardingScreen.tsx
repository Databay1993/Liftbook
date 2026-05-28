import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { LANGUAGES, changeLanguage } from '../i18n';

export const ONBOARDING_KEY = '@liftbook_onboarded';

interface Props {
  onDone: () => void;
}

const STEPS = [
  { icon: '🏋️', key: 'onboardingStep1' },
  { icon: '🏆', key: 'onboardingStep2' },
  { icon: '📋', key: 'onboardingStep3' },
];

export default function OnboardingScreen({ onDone }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [phase, setPhase] = useState<'language' | 'features'>('language');
  const [selectedLang, setSelectedLang] = useState(i18n.language ?? 'en');

  async function handleLanguageContinue() {
    await changeLanguage(selectedLang);
    setPhase('features');
  }

  async function handleStart() {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    onDone();
  }

  // ── Phase 1: Language selection ───────────────────────────────
  if (phase === 'language') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.logo}>LIFTBOOK</Text>
          <Text style={styles.langTitle}>{t('chooseLanguage')}</Text>

          <View style={styles.langList}>
            {LANGUAGES.map(lang => {
              const active = selectedLang === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langItem, active && styles.langItemActive]}
                  onPress={() => setSelectedLang(lang.code)}
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

          <TouchableOpacity style={styles.btn} onPress={handleLanguageContinue} activeOpacity={0.8}>
            <Text style={styles.btnText}>{t('continueBtn')} →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Phase 2: Feature walkthrough ──────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.logo}>LIFTBOOK</Text>
        <Text style={styles.title}>{t('onboardingTitle')}</Text>
        <Text style={styles.sub}>{t('onboardingSub')}</Text>

        <View style={styles.steps}>
          {STEPS.map(step => (
            <View key={step.key} style={styles.step}>
              <Text style={styles.stepIcon}>{step.icon}</Text>
              <Text style={styles.stepText}>{t(step.key as any)}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleStart} activeOpacity={0.8}>
          <Text style={styles.btnText}>{t('onboardingStart')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    inner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

    logo: {
      fontFamily: 'BebasNeue_400Regular',
      fontSize: 22,
      letterSpacing: 4,
      color: c.accent,
      marginBottom: 36,
    },

    // ── Language phase ──
    langTitle: {
      fontFamily: 'BebasNeue_400Regular',
      fontSize: 30,
      letterSpacing: 2,
      color: c.text,
      textAlign: 'center',
      marginBottom: 32,
    },
    langList: { width: '100%', gap: 12, marginBottom: 48 },
    langItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      padding: 18,
    },
    langItemActive: { borderColor: c.accent, backgroundColor: c.accentBg },
    langFlag: { fontSize: 32 },
    langLabel: { flex: 1, fontSize: 18, color: c.text },
    langLabelActive: { color: c.accent, fontWeight: '600' },
    checkmark: { color: c.accent, fontSize: 20, fontWeight: '700' },

    // ── Features phase ──
    title: {
      fontFamily: 'BebasNeue_400Regular',
      fontSize: 44,
      letterSpacing: 3,
      color: c.text,
      textAlign: 'center',
      lineHeight: 50,
      marginBottom: 10,
    },
    sub: {
      color: c.muted,
      fontSize: 15,
      textAlign: 'center',
      marginBottom: 40,
    },
    steps: { width: '100%', gap: 16, marginBottom: 48 },
    step: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 16,
    },
    stepIcon: { fontSize: 28 },
    stepText: { flex: 1, color: c.text, fontSize: 15, lineHeight: 22 },

    // ── Shared button ──
    btn: {
      backgroundColor: c.accent,
      paddingVertical: 16,
      paddingHorizontal: 48,
      borderRadius: 8,
      width: '100%',
      alignItems: 'center',
    },
    btnText: {
      fontFamily: 'BebasNeue_400Regular',
      fontSize: 22,
      letterSpacing: 3,
      color: '#000',
    },
  });
}
