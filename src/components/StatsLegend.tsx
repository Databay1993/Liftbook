import React, { useMemo } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Colors } from '../theme';
import { useTheme } from '../context/ThemeContext';
import {
  EPLEY_REP_LIMIT, BLOCK_GAP_DAYS, RAMP_SESSIONS,
  MIN_PAIR_DAYS, MIN_TREND_POINTS, EWMA_TAU_DAYS,
} from '../lib/analytics';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * Explains what every number on the stats screen actually measures.
 *
 * The thresholds are interpolated from the same constants the calculations
 * use, so the text cannot drift away from the behaviour it describes.
 */
export default function StatsLegend({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const values = {
    limit: EPLEY_REP_LIMIT,
    gap: BLOCK_GAP_DAYS,
    ramp: RAMP_SESSIONS,
    pair: MIN_PAIR_DAYS,
    minPoints: MIN_TREND_POINTS,
    tau: EWMA_TAU_DAYS,
  };

  const sections: { key: string; formula?: string }[] = [
    { key: 'legendE1RM', formula: 'e1RM = kg × (1 + Wdh ÷ 30)' },
    { key: 'legendBestSet' },
    { key: 'legendRepLimit' },
    { key: 'legendBlocks' },
    { key: 'legendRamp' },
    { key: 'legendSlope' },
    { key: 'legendBlockCompare' },
    { key: 'legendEwma' },
    { key: 'legendByWeight' },
    { key: 'legendRecent' },
    { key: 'legendPR' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('legendTitle')}</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
          <Text style={styles.intro}>{t('legendIntro')}</Text>

          {sections.map(section => (
            <View key={section.key} style={styles.section}>
              <Text style={styles.sectionTitle}>{t(`${section.key}Title` as any)}</Text>
              {section.formula && <Text style={styles.formula}>{section.formula}</Text>}
              <Text style={styles.body}>{t(`${section.key}Body` as any, values)}</Text>
            </View>
          ))}

          <Text style={styles.footnote}>{t('legendFootnote')}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },

    header: {
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
    title: { fontFamily: 'BebasNeue_400Regular', fontSize: 22, letterSpacing: 2, color: c.text, flex: 1 },
    closeBtn: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    closeTxt: { color: c.muted, fontSize: 14 },

    content: { padding: 16 },
    intro: { fontSize: 14, color: c.muted, lineHeight: 21, marginBottom: 20 },

    section: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      padding: 14,
      marginBottom: 10,
    },
    sectionTitle: {
      fontFamily: 'BebasNeue_400Regular',
      fontSize: 16,
      letterSpacing: 1,
      color: c.accent,
      marginBottom: 6,
    },
    formula: {
      fontSize: 13,
      color: c.text,
      backgroundColor: c.surface2,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      marginBottom: 8,
      textAlign: 'center',
    },
    body: { fontSize: 13, color: c.text, lineHeight: 20 },

    footnote: {
      fontSize: 12,
      color: c.muted,
      lineHeight: 18,
      marginTop: 10,
      paddingHorizontal: 4,
      fontStyle: 'italic',
    },
  });
}
