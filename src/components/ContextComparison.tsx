import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Colors } from '../theme';
import { useTheme } from '../context/ThemeContext';
import {
  ContextAnalysis, groupAverage, summarizeTrend, MIN_TREND_POINTS,
} from '../lib/analytics';

interface Props {
  analysis: ContextAnalysis;
  muscleGroup: string | null;
}

/**
 * Compares an exercise only against sessions where the same muscle group was
 * equally fresh — rowing after pull-ups against rowing after pull-ups, not
 * against rowing done first.
 */
export default function ContextComparison({ analysis, muscleGroup }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!muscleGroup) {
    return (
      <View style={styles.notice}>
        <Text style={styles.noticeTxt}>{t('contextNoGroup')}</Text>
      </View>
    );
  }

  const { groups, currentKey } = analysis;
  if (groups.length === 0) {
    return <Text style={styles.empty}>{t('noData')}</Text>;
  }

  const averages = groups.map(groupAverage);
  const best = Math.max(...averages, 1);
  const current = groups.find(g => g.key === currentKey) ?? null;
  const currentTrend = current ? summarizeTrend(current.points) : null;

  const label = (preceding: string[]) =>
    preceding.length === 0 ? t('contextFresh') : `${t('contextAfter')} ${preceding.join(' + ')}`;

  return (
    <View style={styles.wrap}>
      <Text style={styles.intro}>{t('contextIntro')}</Text>

      {groups.map((group, i) => {
        const avg = averages[i];
        const isCurrent = group.key === currentKey;
        return (
          <View key={group.key || '_fresh'} style={[styles.row, isCurrent && styles.rowCurrent]}>
            <View style={styles.rowHead}>
              <Text style={[styles.rowLabel, isCurrent && styles.rowLabelCurrent]} numberOfLines={2}>
                {label(group.preceding)}
              </Text>
              <Text style={styles.rowAvg}>{Math.round(avg)} kg</Text>
            </View>
            <View style={styles.barBg}>
              <View style={[
                styles.barFill,
                { width: `${Math.round((avg / best) * 100)}%` },
                isCurrent && { backgroundColor: colors.accent },
              ]} />
            </View>
            <Text style={styles.rowMeta}>
              {group.points.length} {t('sessions')}
              {i > 0 ? ` · ${(avg - averages[0] >= 0 ? '+' : '−')}${Math.abs(Math.round(avg - averages[0]))} kg ${t('contextVsBest')}` : ''}
            </Text>
          </View>
        );
      })}

      {/* Verdict for the context the newest session belongs to */}
      {current && (
        <View style={styles.verdict}>
          {current.points.length < MIN_TREND_POINTS || !currentTrend?.reliable ? (
            <Text style={styles.verdictWarn}>
              {t('contextTooFew', { count: current.points.length, context: label(current.preceding) })}
            </Text>
          ) : (
            <Text style={styles.verdictTxt}>
              {currentTrend.spanTooShort
                ? t('contextChange', {
                    context: label(current.preceding),
                    value: (currentTrend.changeOverSpan ?? 0).toFixed(1),
                    days: currentTrend.spanDays,
                  })
                : t('contextTrend', {
                    context: label(current.preceding),
                    value: (currentTrend.slopePerMonth ?? 0).toFixed(1),
                  })}
            </Text>
          )}
        </View>
      )}

      {analysis.orderInferred && (
        <Text style={styles.footnote}>{t('contextOrderInferred')}</Text>
      )}
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    wrap: { gap: 8, paddingHorizontal: 4 },
    intro: { fontSize: 11, color: c.muted, lineHeight: 16, marginBottom: 2 },
    empty: { color: c.muted, fontSize: 12, paddingVertical: 8, paddingHorizontal: 4 },

    notice: {
      borderWidth: 1, borderColor: c.border, borderStyle: 'dashed',
      borderRadius: 8, padding: 12, marginHorizontal: 4,
    },
    noticeTxt: { fontSize: 12, color: c.muted, lineHeight: 18 },

    row: {
      backgroundColor: c.surface2,
      borderWidth: 1, borderColor: c.border,
      borderRadius: 8,
      padding: 10,
      gap: 5,
    },
    rowCurrent: { borderColor: c.accent, backgroundColor: c.accentBg },
    rowHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
    rowLabel: { flex: 1, fontSize: 13, color: c.text },
    rowLabelCurrent: { fontWeight: '700', color: c.accent },
    rowAvg: { fontFamily: 'BebasNeue_400Regular', fontSize: 18, color: c.text },
    rowMeta: { fontSize: 10, color: c.muted },

    barBg: { height: 6, borderRadius: 3, backgroundColor: c.bg, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 3, backgroundColor: c.muted },

    verdict: {
      borderTopWidth: 1, borderTopColor: c.border,
      paddingTop: 8, marginTop: 2,
    },
    verdictTxt: { fontSize: 12, color: c.text, lineHeight: 18 },
    verdictWarn: { fontSize: 12, color: c.accent2, lineHeight: 18 },

    footnote: { fontSize: 10, color: c.muted, fontStyle: 'italic', marginTop: 4 },
  });
}
