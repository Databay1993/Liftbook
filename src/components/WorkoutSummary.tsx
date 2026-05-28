import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors } from '../theme';
import { useTheme } from '../context/ThemeContext';

interface Props {
  visible: boolean;
  totalSets: number;
  totalVolume: number;
  newPRs: string[];
  onClose: () => void;
}

export default function WorkoutSummary({ visible, totalSets, totalVolume, newPRs, onClose }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.title}>{t('workoutDone')}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{totalSets}</Text>
              <Text style={styles.statLabel}>{t('summaryTotalSets')}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{totalVolume.toLocaleString()}</Text>
              <Text style={styles.statLabel}>{t('summaryTotalVolume')} (kg)</Text>
            </View>
          </View>

          {newPRs.length > 0 && (
            <View style={styles.prBox}>
              <Text style={styles.prTitle}>{t('summaryNewPR')}</Text>
              {newPRs.map(pr => (
                <Text key={pr} style={styles.prName}>{pr}</Text>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.btn} onPress={onClose}>
            <Text style={styles.btnText}>{t('summaryClose')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    inner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    title: {
      fontFamily: 'BebasNeue_400Regular',
      fontSize: 36,
      letterSpacing: 2,
      color: c.text,
      marginBottom: 32,
      textAlign: 'center',
    },
    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24, width: '100%' },
    statCard: {
      flex: 1,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 20,
      alignItems: 'center',
    },
    statNum: { fontFamily: 'BebasNeue_400Regular', fontSize: 42, color: c.accent },
    statLabel: { color: c.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4, textAlign: 'center' },
    prBox: {
      width: '100%',
      backgroundColor: c.accentBg,
      borderWidth: 1,
      borderColor: c.accent,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
    },
    prTitle: { color: c.accent, fontWeight: '700', fontSize: 14, marginBottom: 8 },
    prName: { color: c.text, fontSize: 14, paddingVertical: 2 },
    btn: {
      backgroundColor: c.accent,
      paddingVertical: 16,
      borderRadius: 8,
      width: '100%',
      alignItems: 'center',
      marginTop: 8,
    },
    btnText: { fontFamily: 'BebasNeue_400Regular', fontSize: 20, letterSpacing: 2, color: '#000' },
  });
}
